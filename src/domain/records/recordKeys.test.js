// 記録の識別キー生成（純粋）の単体テスト。#274 で localStorage リポジトリから分離した
// wordRecKey/dictRecKey/storyRecKey/itemId を被覆する（各 repo テストのキー生成ケースを移植）。
import { describe, it, expect } from 'vitest'
import { wordRecKey, dictRecKey, storyRecKey, itemId } from './recordKeys.service.js'

describe('wordRecKey', () => {
  it('L{level}__{theme}__{mode} 形式（終了条件なし＝time60/未指定はタグ無し）', () => {
    expect(wordRecKey(3, 'ビジネス', 'quiz-en')).toBe('L3__ビジネス__quiz-en')
    expect(wordRecKey(1, 'すべて', 'en', { kind: 'time', value: 60 })).toBe('L1__すべて__en')
  })

  it('終了条件ありは末尾に __<tag> を付ける', () => {
    expect(wordRecKey(1, 'すべて', 'en', { kind: 'endless' })).toBe('L1__すべて__en__E')
    expect(wordRecKey(2, '旅行', 'en', { kind: 'items', value: 20 })).toBe('L2__旅行__en__I20')
  })
})

// #362 S2: wordRecKey に第5引数 range を追加（単語固定範囲）。
// 後方互換＝range 省略/未指定は従来と完全に同一のキー。range 有りは ec タグの後ろに __R{range}。
describe('wordRecKey range（#362 単語固定範囲）', () => {
  const time60 = { kind: 'time', value: 60 }
  const items25 = { kind: 'items', value: 25 } // END_ITEMS_VALUES=[10,25,50] の有効値

  it('range 省略は従来と完全に同一のキー（後方互換）', () => {
    expect(wordRecKey(1, '日常', 'en', time60)).toBe('L1__日常__en')
  })

  it('range が undefined/null なら range 未指定＝従来キーと同一', () => {
    expect(wordRecKey(1, '日常', 'en', time60, undefined)).toBe('L1__日常__en')
    expect(wordRecKey(1, '日常', 'en', time60, null)).toBe('L1__日常__en')
  })

  it('range 指定は末尾に __R{range} を付ける', () => {
    expect(wordRecKey(1, '日常', 'en', time60, 2)).toBe('L1__日常__en__R2')
  })

  it('終了条件タグ→range の順で連結する（ec タグの後ろに __R{range}）', () => {
    expect(wordRecKey(1, '日常', 'en', items25, 2)).toBe('L1__日常__en__I25__R2')
  })
})

describe('dictRecKey', () => {
  it('L{level}__{theme}__{mode} 形式（終了条件なし）', () => {
    expect(dictRecKey(1, 'すべて', 'quiz')).toBe('L1__すべて__quiz')
  })

  it('終了条件ありは末尾に __<tag> を付ける', () => {
    expect(dictRecKey(3, 'ビジネス', 'ja', { kind: 'life', value: 3 })).toBe('L3__ビジネス__ja__L3')
  })

})

// #364 dict/wsent 固定範囲：dictRecKey に第5引数 range を追加（英英辞典の固定範囲）。
// #362 では dict に範囲が無く range を無視していたが、#364 で dict も範囲別ランキングを持つため
// wordRecKey と同形にする（#362 の dict「range 無視」仕様はここで置き換わる）。
// 後方互換＝range 省略/未指定（undefined/null）は従来と完全に同一のキー。range 有りは ec タグの後ろに __R{range}。
describe('dictRecKey range（#364 英英固定範囲）', () => {
  const time60 = { kind: 'time', value: 60 }
  const items25 = { kind: 'items', value: 25 }

  it('range 省略は従来と完全に同一のキー（後方互換）', () => {
    expect(dictRecKey(1, '日常', 'en', time60)).toBe('L1__日常__en')
  })

  it('range が undefined/null なら range 未指定＝従来キーと同一', () => {
    expect(dictRecKey(1, '日常', 'en', time60, undefined)).toBe('L1__日常__en')
    expect(dictRecKey(1, '日常', 'en', time60, null)).toBe('L1__日常__en')
  })

  it('range 指定は末尾に __R{range} を付ける', () => {
    expect(dictRecKey(1, '日常', 'en', time60, 2)).toBe('L1__日常__en__R2')
  })

  it('終了条件タグ→range の順で連結する（ec タグの後ろに __R{range}）', () => {
    expect(dictRecKey(1, '日常', 'en', items25, 2)).toBe('L1__日常__en__I25__R2')
  })
})

describe('storyRecKey', () => {
  it('story-records-v1-<id> 接頭辞（終了条件なし＝従来キーと一致）', () => {
    expect(storyRecKey('climbing')).toBe('story-records-v1-climbing')
    expect(storyRecKey('travel', { kind: 'time', value: 60 })).toBe('story-records-v1-travel')
  })

  it('終了条件ありは base と別キー（__<tag>）に分かれる', () => {
    const base = storyRecKey('climbing')
    const endless = storyRecKey('climbing', { kind: 'endless' })
    expect(endless).not.toBe(base)
    expect(endless).toBe('story-records-v1-climbing__E')
  })
})

describe('itemId', () => {
  it('type:mode:key 形式', () => {
    expect(itemId('w', 'en', 'reserve')).toBe('w:en:reserve')
    expect(itemId('d', 'ja', 'hotel')).toBe('d:ja:hotel')
  })

  it('key に : を含んでもそのまま連結する（文中コロン）', () => {
    expect(itemId('s', 'both', 'I go to school: today.')).toBe('s:both:I go to school: today.')
  })
})
