// #451 記録の1件削除：生記録から「どのマップのどのキーに属するか」を導く純関数の仕様。
// 削除は「記録メモリ像の 6 マップのうち、どの store の、どの key の配列にいるか」が分からないと
// できない。routeFromRawRecord（recordDetailRoute.policy）が既に「記録単体から座標を導ける」ことを
// 示しているので、同じ考え方でキー座標（store/key）を返す domain サービスを立てる。
// キーは既存のキー関数（recKey/wordRecKey/dictRecKey/storyRecKey）の出力と厳密に一致すること
// （キー生成をここで再実装しない＝保存側と削除側でキーがずれない不変条件）。
import { describe, it, expect } from 'vitest'
import { recordGroupOf } from './recordGroup.service.js'
import { recKey } from './ranking.service.js'
import { wordRecKey, dictRecKey, storyRecKey } from './recordKeys.service.js'

const time60 = { kind: 'time', value: 60 }
const items25 = { kind: 'items', value: 25 }
const endless = { kind: 'endless' }

// 入力を変更していないこと（純粋・非破壊）を確かめる補助。
const expectUntouched = (record, fn) => {
  const snapshot = JSON.parse(JSON.stringify(record))
  fn()
  expect(record).toEqual(snapshot)
}

describe('recordGroupOf（source → store と key の振り分け）', () => {
  it("source:'word' は wordRecords と wordRecKey のキーを返す", () => {
    const record = { source: 'word', level: 2, theme: '旅行', mode: 'en', keys: 40 }
    expect(recordGroupOf(record)).toEqual({
      store: 'wordRecords',
      key: wordRecKey(2, '旅行', 'en', undefined, undefined),
    })
  })

  it("source:'dict' は dictRecords と dictRecKey のキーを返す", () => {
    const record = { source: 'dict', level: 3, theme: 'ビジネス', mode: 'ja', keys: 50 }
    expect(recordGroupOf(record)).toEqual({
      store: 'dictRecords',
      key: dictRecKey(3, 'ビジネス', 'ja', undefined, undefined),
    })
  })

  it("source:'story' は storyRecords と storyRecKey のキーを返す（座標は record.storyId）", () => {
    const record = { source: 'story', storyId: 'travel', mode: 'both', keys: 80 }
    expect(recordGroupOf(record)).toEqual({
      store: 'storyRecords',
      key: storyRecKey('travel', undefined),
    })
  })

  it("source:'sentence' は records と recKey のキーを返す（マラソン文章）", () => {
    const record = { source: 'sentence', mode: 'both', rank: 1, keys: 100 }
    expect(recordGroupOf(record)).toEqual({
      store: 'records',
      key: recKey('both', 1, 'sentence', undefined, undefined, undefined),
    })
  })

  it('source 未指定は records 側に落ちる（recKey の既定 source=sentence と一致）', () => {
    const record = { mode: 'both', rank: 1, keys: 100 }
    const group = recordGroupOf(record)
    expect(group.store).toBe('records')
    expect(group.key).toBe(recKey('both', 1, 'sentence', undefined, undefined, undefined))
    expect(group.key).toBe('both__r1') // 従来キーそのもの
  })

  it("source:'wsent'（単語例文）は records と recKey のキー（theme 込み）を返す", () => {
    const record = { source: 'wsent', mode: 'sentence', rank: 1, theme: '旅行', keys: 40 }
    expect(recordGroupOf(record)).toEqual({
      store: 'records',
      key: recKey('sentence', 1, 'wsent', '旅行', undefined, undefined),
    })
  })

  it("source:'touch'/'romaji' も records 側に落ちる（URL 非対象でも記録は records マップにある）", () => {
    const touch = { source: 'touch', mode: 'home', rank: 1, keys: 30 }
    const romaji = { source: 'romaji', mode: 'kana', rank: 2, keys: 20 }
    expect(recordGroupOf(touch)).toEqual({
      store: 'records',
      key: recKey('home', 1, 'touch', undefined, undefined, undefined),
    })
    expect(recordGroupOf(romaji)).toEqual({
      store: 'records',
      key: recKey('kana', 2, 'romaji', undefined, undefined, undefined),
    })
  })
})

describe('recordGroupOf の endCondition 次元（#208 終了条件別ランキング）', () => {
  it('endCondition 未指定と time60 は同じキー（既定＝タグ無し）', () => {
    const bare = { source: 'word', level: 1, theme: 'すべて', mode: 'en' }
    const explicit = { ...bare, endCondition: time60 }
    expect(recordGroupOf(bare).key).toBe(recordGroupOf(explicit).key)
    expect(recordGroupOf(bare).key).toBe('L1__すべて__en')
  })

  it('endCondition 指定（items25）は未指定と別キーになる', () => {
    const bare = { source: 'word', level: 1, theme: 'すべて', mode: 'en' }
    const i25 = { ...bare, endCondition: items25 }
    expect(recordGroupOf(i25).key).not.toBe(recordGroupOf(bare).key)
    expect(recordGroupOf(i25).key).toBe(wordRecKey(1, 'すべて', 'en', items25, undefined))
  })

  it('物語も endCondition 別に別キーへ分かれる', () => {
    const bare = { source: 'story', storyId: 'climbing' }
    const e = { ...bare, endCondition: endless }
    expect(recordGroupOf(e).key).not.toBe(recordGroupOf(bare).key)
    expect(recordGroupOf(e).key).toBe(storyRecKey('climbing', endless))
  })

  it('マラソン記録も endCondition 別に別キーへ分かれる', () => {
    const bare = { mode: 'both', rank: 1 }
    const t30 = { ...bare, endCondition: { kind: 'time', value: 30 } }
    expect(recordGroupOf(t30).key).not.toBe(recordGroupOf(bare).key)
    expect(recordGroupOf(t30).key).toBe(
      recKey('both', 1, 'sentence', undefined, { kind: 'time', value: 30 }, undefined)
    )
  })
})

describe('recordGroupOf の range 次元（#362/#364 固定範囲）', () => {
  it('range 有りの単語記録は range 無しと別キーになる', () => {
    const bare = { source: 'word', level: 1, theme: '日常', mode: 'en', endCondition: time60 }
    const ranged = { ...bare, range: 2 }
    expect(recordGroupOf(ranged).key).not.toBe(recordGroupOf(bare).key)
    expect(recordGroupOf(ranged).key).toBe(wordRecKey(1, '日常', 'en', time60, 2))
  })

  it('range 有りの英英記録も range 無しと別キーになる', () => {
    const bare = { source: 'dict', level: 1, theme: '日常', mode: 'en', endCondition: time60 }
    const ranged = { ...bare, range: 3 }
    expect(recordGroupOf(ranged).key).not.toBe(recordGroupOf(bare).key)
    expect(recordGroupOf(ranged).key).toBe(dictRecKey(1, '日常', 'en', time60, 3))
  })

  it('range 有りの単語例文（wsent）記録も records 側で別キーになる', () => {
    const bare = { source: 'wsent', mode: 'sentence', rank: 1, theme: '旅行' }
    const ranged = { ...bare, range: 2 }
    expect(recordGroupOf(ranged).key).not.toBe(recordGroupOf(bare).key)
    expect(recordGroupOf(ranged).key).toBe(recKey('sentence', 1, 'wsent', '旅行', undefined, 2))
  })
})

describe('recordGroupOf の全域性（どんな入力でも throw しない）', () => {
  it('null / undefined は null を返す', () => {
    expect(recordGroupOf(null)).toBeNull()
    expect(recordGroupOf(undefined)).toBeNull()
  })

  it('オブジェクトでない値（文字列・数値・配列）は null を返す', () => {
    expect(recordGroupOf('record')).toBeNull()
    expect(recordGroupOf(42)).toBeNull()
    expect(recordGroupOf([])).toBeNull()
  })

  it('空オブジェクトは座標を持たないので null を返す（"undefined__rundefined" を作らない）', () => {
    expect(recordGroupOf({})).toBeNull()
  })

  it("source:'story' でも storyId が無ければ null を返す（storyId 無しのキーを作らない）", () => {
    expect(recordGroupOf({ source: 'story', mode: 'both', keys: 10 })).toBeNull()
  })
})

describe('recordGroupOf の純粋性', () => {
  it('引数の記録を変更しない（非破壊）', () => {
    const record = { source: 'word', level: 1, theme: '日常', mode: 'en', range: 2, keys: 10 }
    expectUntouched(record, () => recordGroupOf(record))
  })

  it('同じ入力なら常に同じ結果を返す（決定的）', () => {
    const record = { source: 'dict', level: 2, theme: '旅行', mode: 'ja', endCondition: items25 }
    expect(recordGroupOf(record)).toEqual(recordGroupOf(record))
  })
})
