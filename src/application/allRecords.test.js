// 全記録横断ビュー（Issue #248）の純粋ロジック契約①②の仕様テスト。
// 対象実装（未実装）: src/application/allRecords.js の flattenRecords / sortAllRecords。
// 実データ形状の根拠:
//   - typing-records-v3(loadRecords): キー→記録配列。record.source ∈ 'wsent'|'story'|'touch' 等、
//     level は record.rank に入る（recKey(mode, rank, source, theme)）、theme は record.theme。
//   - dict-records-v1(loadDictRecords): キー→記録配列。record は level/theme/mode/keys… を持ち source:'dict'。
//   - word-records-v2(loadWordRecords): キー→記録配列。record は level/theme/mode/keys… を持ち source:'word'。
//   - 記録の数値/日時フィールド: speed / accuracy / mistakes / keys / seconds / date(toLocaleString('ja-JP'))。
import { describe, it, expect } from 'vitest'
import { flattenRecords, sortAllRecords } from './allRecords.js'

// ── 契約①: flattenRecords({ records, dictRecords, wordRecords }) ──
describe('flattenRecords（3リポジトリの生データを正規化フラット配列へ）', () => {
  it('空データ({})は空配列を返す', () => {
    expect(flattenRecords({ records: {}, dictRecords: {}, wordRecords: {} })).toEqual([])
  })

  it('記録配列が空のキーは何も生まない（空配列を返す）', () => {
    const out = flattenRecords({
      records: { 'both__wsent2__旅行': [] },
      dictRecords: { 'L1__すべて__quiz': [] },
      wordRecords: { 'L3__旅行__en': [] },
    })
    expect(out).toEqual([])
  })

  it('typing-records の wsent 記録を kind=wsent（文章）へ正規化する（level は rank から）', () => {
    const rec = {
      source: 'wsent',
      mode: 'both',
      rank: 2, // wsent は rank に level が入る
      theme: '旅行',
      speed: 480,
      accuracy: 98,
      mistakes: 7,
      keys: 300,
      seconds: 75,
      date: '2026/7/7 12:00:00',
    }
    const [el] = flattenRecords({
      records: { 'both__wsent2__旅行': [rec] },
      dictRecords: {},
      wordRecords: {},
    })
    expect(el).toMatchObject({
      kind: 'wsent',
      kindLabel: '文章',
      level: 2,
      mode: 'both',
      theme: '旅行',
      speed: 480,
      accuracy: 98,
      mistakes: 7,
      keys: 300,
      seconds: 75,
      date: '2026/7/7 12:00:00',
    })
    // 表示用ラベル列は必ず文字列として生成される（正確な語彙は司令塔に確認・下記 report 参照）。
    expect(typeof el.levelLabel).toBe('string')
    expect(typeof el.modeLabel).toBe('string')
  })

  it('dict 記録は kind=dict（英英）固定で level/theme/mode を写像する', () => {
    const rec = {
      source: 'dict',
      level: 1,
      theme: 'すべて',
      mode: 'quiz',
      speed: 200,
      accuracy: 80,
      mistakes: 2,
      keys: 40,
      seconds: 60,
      date: '2026/7/5 09:00:00',
    }
    const [el] = flattenRecords({
      records: {},
      dictRecords: { 'L1__すべて__quiz': [rec] },
      wordRecords: {},
    })
    expect(el).toMatchObject({
      kind: 'dict',
      kindLabel: '英英',
      level: 1,
      theme: 'すべて',
      mode: 'quiz',
      speed: 200,
      accuracy: 80,
      mistakes: 2,
      keys: 40,
      seconds: 60,
    })
  })

  it('word 記録は kind=words（単語）固定へ写像する（record.source は "word" だが kind は "words"）', () => {
    const rec = {
      source: 'word',
      level: 3,
      theme: '旅行',
      mode: 'en',
      speed: 300,
      accuracy: 95,
      mistakes: 1,
      keys: 80,
      seconds: 60,
      date: '2026/7/4 08:00:00',
    }
    const [el] = flattenRecords({
      records: {},
      dictRecords: {},
      wordRecords: { 'L3__旅行__en': [rec] },
    })
    expect(el).toMatchObject({
      kind: 'words',
      kindLabel: '単語',
      level: 3,
      theme: '旅行',
      mode: 'en',
      keys: 80,
    })
  })

  it('タッチ(source=touch)記録は対象外として除外する', () => {
    const out = flattenRecords({
      records: {
        'easy__touch1': [
          { source: 'touch', mode: 'easy', rank: 1, speed: 100, accuracy: 90, mistakes: 1, keys: 50, seconds: 60, date: '2026/7/6 10:00:00' },
        ],
      },
      dictRecords: {},
      wordRecords: {},
    })
    expect(out).toEqual([])
    expect(out.some((e) => e.kind === 'touch')).toBe(false)
  })

  it('3リポジトリの記録を1本のフラット配列にまとめる（各キーの全ランクを展開）', () => {
    const out = flattenRecords({
      records: {
        'both__wsent2__旅行': [
          { source: 'wsent', mode: 'both', rank: 2, theme: '旅行', speed: 480, accuracy: 98, mistakes: 7, keys: 300, seconds: 75, date: '2026/7/7 12:00:00' },
          { source: 'wsent', mode: 'both', rank: 2, theme: '旅行', speed: 460, accuracy: 97, mistakes: 8, keys: 290, seconds: 76, date: '2026/7/1 12:00:00' },
        ],
      },
      dictRecords: {
        'L1__すべて__quiz': [
          { source: 'dict', level: 1, theme: 'すべて', mode: 'quiz', speed: 200, accuracy: 80, mistakes: 2, keys: 40, seconds: 60, date: '2026/7/5 09:00:00' },
        ],
      },
      wordRecords: {
        'L3__旅行__en': [
          { source: 'word', level: 3, theme: '旅行', mode: 'en', speed: 300, accuracy: 95, mistakes: 1, keys: 80, seconds: 60, date: '2026/7/4 08:00:00' },
        ],
      },
    })
    expect(out).toHaveLength(4)
    expect(out.filter((e) => e.kind === 'wsent')).toHaveLength(2)
    expect(out.filter((e) => e.kind === 'dict')).toHaveLength(1)
    expect(out.filter((e) => e.kind === 'words')).toHaveLength(1)
  })

  it('欠損フィールドの旧記録でも例外を出さず妥当なフォールバックを入れる（数値0・level/theme/date は null）', () => {
    const out = flattenRecords({
      records: { 'both__wsent1': [{ source: 'wsent', mode: 'both' }] }, // rank/theme/数値/date 欠損
      dictRecords: {},
      wordRecords: {},
    })
    expect(out).toHaveLength(1)
    const [el] = out
    expect(el.kind).toBe('wsent')
    expect(el.speed).toBe(0)
    expect(el.accuracy).toBe(0)
    expect(el.mistakes).toBe(0)
    expect(el.keys).toBe(0)
    expect(el.seconds).toBe(0)
    expect(el.level).toBeNull()
    expect(el.theme).toBeNull()
    expect(el.date).toBeNull()
  })

  it('dateTs は date 文字列から比較可能な値になる（後の日時ほど大きい）', () => {
    const [older, newer] = flattenRecords({
      records: {
        k: [
          { source: 'wsent', mode: 'both', rank: 1, date: '2026/7/1 09:00:00' },
          { source: 'wsent', mode: 'both', rank: 1, date: '2026/7/7 09:00:00' },
        ],
      },
      dictRecords: {},
      wordRecords: {},
    })
    expect(older.dateTs).toBeLessThan(newer.dateTs)
  })

  // 【仮定・要確認】Issue #248 は対象に物語(story)を含むが、flattenRecords の署名は
  // { records, dictRecords, wordRecords } の3リポジトリのみで、物語は別ストレージ
  // (story-records-v1-<storyId> の配列)に保存される。ここでは「records マップ内に
  // source:'story' の記録が現れたら kind=story(物語) へ写像する」という契約解釈でテストする。
  // 物語記録をどの入力から流し込むか（4つ目の引数か records への集約か）は司令塔に要確認。
  it('records マップ内の source=story 記録は kind=story（物語）へ写像する（物語は level/theme を持たず null）', () => {
    const out = flattenRecords({
      records: {
        'both__story': [
          { source: 'story', mode: 'both', storyId: 'travel', speed: 350, accuracy: 99, mistakes: 3, keys: 120, seconds: 40, date: '2026/7/3 07:00:00' },
        ],
      },
      dictRecords: {},
      wordRecords: {},
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'story', kindLabel: '物語', mode: 'both' })
    expect(out[0].level).toBeNull()
    expect(out[0].theme).toBeNull()
  })
})

// ── 契約②: sortAllRecords(list, key, dir) ──
describe('sortAllRecords（列キーと昇降で並べ替える純関数）', () => {
  // 正規化済み行を最小構成で作るヘルパー（テスト専用フィクスチャ）。
  const row = (over) => ({
    kind: 'words',
    kindLabel: '単語',
    level: 1,
    levelLabel: '',
    mode: 'en',
    modeLabel: '',
    theme: 'すべて',
    speed: 0,
    accuracy: 0,
    mistakes: 0,
    keys: 0,
    seconds: 0,
    date: '',
    dateTs: 0,
    ...over,
  })

  it('speed を数値で昇順に並べる', () => {
    const list = [row({ speed: 300 }), row({ speed: 100 }), row({ speed: 200 })]
    const out = sortAllRecords(list, 'speed', 'asc')
    expect(out.map((r) => r.speed)).toEqual([100, 200, 300])
  })

  it('speed を数値で降順に並べる', () => {
    const list = [row({ speed: 100 }), row({ speed: 300 }), row({ speed: 200 })]
    const out = sortAllRecords(list, 'speed', 'desc')
    expect(out.map((r) => r.speed)).toEqual([300, 200, 100])
  })

  it('date は dateTs で比較する（昇順＝古い順）', () => {
    const list = [row({ id: 'c', dateTs: 30 }), row({ id: 'a', dateTs: 10 }), row({ id: 'b', dateTs: 20 })]
    const out = sortAllRecords(list, 'date', 'asc')
    expect(out.map((r) => r.dateTs)).toEqual([10, 20, 30])
  })

  it('accuracy/keys/seconds/mistakes も数値比較で並ぶ（代表: keys 降順）', () => {
    const list = [row({ keys: 40 }), row({ keys: 90 }), row({ keys: 60 })]
    const out = sortAllRecords(list, 'keys', 'desc')
    expect(out.map((r) => r.keys)).toEqual([90, 60, 40])
  })

  it('kind は意味順（文章→物語→単語→英英）で並ぶ', () => {
    const kinds = ['dict', 'wsent', 'words', 'story']
    const list = kinds.map((k) => row({ kind: k }))
    const out = sortAllRecords(list, 'kind', 'asc')
    expect(out.map((r) => r.kind)).toEqual(['wsent', 'story', 'words', 'dict'])
  })

  it('kind の降順は意味順の逆（英英→単語→物語→文章）', () => {
    const kinds = ['wsent', 'dict', 'story', 'words']
    const list = kinds.map((k) => row({ kind: k }))
    const out = sortAllRecords(list, 'kind', 'desc')
    expect(out.map((r) => r.kind)).toEqual(['dict', 'words', 'story', 'wsent'])
  })

  it('level は数値の意味順で並ぶ（昇順）', () => {
    const list = [row({ level: 3 }), row({ level: 1 }), row({ level: 2 })]
    const out = sortAllRecords(list, 'level', 'asc')
    expect(out.map((r) => r.level)).toEqual([1, 2, 3])
  })

  it('同値は安定（入力順を維持する）', () => {
    const list = [row({ id: 'a', speed: 100 }), row({ id: 'b', speed: 100 }), row({ id: 'c', speed: 100 })]
    const out = sortAllRecords(list, 'speed', 'asc')
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('元配列を破壊しない（非破壊）', () => {
    const list = [row({ speed: 300 }), row({ speed: 100 }), row({ speed: 200 })]
    const snapshot = JSON.parse(JSON.stringify(list))
    sortAllRecords(list, 'speed', 'asc')
    expect(list).toEqual(snapshot)
  })

  it('空配列は空配列を返す', () => {
    expect(sortAllRecords([], 'speed', 'asc')).toEqual([])
  })

  it('未知 key は安全に素通しする（入力順のまま・非破壊）', () => {
    const list = [row({ id: 'a', speed: 300 }), row({ id: 'b', speed: 100 })]
    const out = sortAllRecords(list, 'bogus', 'asc')
    expect(out.map((r) => r.id)).toEqual(['a', 'b'])
  })
})
