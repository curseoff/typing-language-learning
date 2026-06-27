import { describe, it, expect } from 'vitest'
import { buildUnits, scramble, segMatches } from './units.js'
import { mulberry32 } from '../rng.js'

const item = { en: 'reserve', ja: '予約する', kana: 'よやくする', jaWords: ['予約', 'する'] }

describe('buildUnits', () => {
  it('en は英語1セグメント', () => {
    const segs = buildUnits(item, 'en')
    expect(segs.map((s) => s.type)).toEqual(['en'])
    expect(segs[0].variants).toContain('reserve')
  })

  it('ja は日本語1セグメント（ローマ字variants）', () => {
    const segs = buildUnits(item, 'ja')
    expect(segs.map((s) => s.type)).toEqual(['ja'])
    expect(segs[0].variants).toContain('yoyakusuru')
  })

  it('both は英→日の2セグメント（日常会話と同じ）', () => {
    const segs = buildUnits(item, 'both')
    expect(segs.map((s) => s.type)).toEqual(['en', 'ja'])
  })
})

describe('buildUnits の word 付与（単語例文の対応単語）', () => {
  // 単語例文（マラソン）の item: word がその例文の見出し単語
  const wordItem = {
    level: 1,
    word: 'above',
    en: 'The clouds are above the mountain.',
    ja: '雲は山の上にあります。',
    kana: 'くもはやまのうえにあります。',
    jaWords: ['雲', 'は', '山', 'の', '上', 'に', 'あり', 'ます'],
  }

  it("en の各セグメントが word を持ち、item.word に等しい", () => {
    const segs = buildUnits(wordItem, 'en')
    expect(segs.every((s) => s.word === 'above')).toBe(true)
  })

  it("ja の各セグメントが word を持ち、item.word に等しい", () => {
    const segs = buildUnits(wordItem, 'ja')
    expect(segs.every((s) => s.word === 'above')).toBe(true)
  })

  it("both は2セグメントとも word を持ち、item.word に等しい", () => {
    const segs = buildUnits(wordItem, 'both')
    expect(segs).toHaveLength(2)
    expect(segs.every((s) => s.word === 'above')).toBe(true)
  })

  it("en-tr の各セグメントが word を持ち、item.word に等しい", () => {
    const segs = buildUnits(wordItem, 'en-tr', { rng: mulberry32(7) })
    expect(segs.every((s) => s.word === 'above')).toBe(true)
  })

  it("ja-tr の各セグメントが word を持ち、item.word に等しい", () => {
    const segs = buildUnits(wordItem, 'ja-tr', { rng: mulberry32(7) })
    expect(segs.every((s) => s.word === 'above')).toBe(true)
  })

  it("後方互換: word が無い item ではセグメントの word は undefined（他フィールドは不変）", () => {
    // item には word が無い
    expect(item.word).toBeUndefined()
    for (const mode of ['en', 'ja', 'both', 'en-tr', 'ja-tr']) {
      const segs = buildUnits(item, mode, { rng: mulberry32(7) })
      expect(segs.every((s) => s.word === undefined)).toBe(true)
    }
    // 既存挙動（variants 等）は壊さない
    expect(buildUnits(item, 'en')[0].variants).toContain('reserve')
  })
})

describe('segMatches', () => {
  it('途中入力の前方一致を判定する', () => {
    const seg = buildUnits(item, 'ja')[0]
    expect(segMatches(seg, 'yoyaku')).toBe(true)
    expect(segMatches(seg, 'zzz')).toBe(false)
  })
})

describe('rng 注入（決定的）', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8]

  it('scramble は同じ seed の rng で同じ並びを返す', () => {
    const a = scramble(arr, mulberry32(42))
    const b = scramble(arr, mulberry32(42))
    expect(a).toEqual(b)
    // 元配列は不変・要素は保存される
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...a].sort((x, y) => x - y)).toEqual(arr)
  })

  it('scramble は seed が違えば（多くの場合）並びが変わる', () => {
    const a = scramble(arr, mulberry32(1))
    const b = scramble(arr, mulberry32(2))
    expect(a).not.toEqual(b)
  })

  it('buildUnits(en-tr) の chips 並びは同じ seed で一致する', () => {
    const a = buildUnits(item, 'en-tr', { rng: mulberry32(7) })[0].chips
    const b = buildUnits(item, 'en-tr', { rng: mulberry32(7) })[0].chips
    expect(a).toEqual(b)
  })

  it('buildUnits(ja-tr) の chips 並びは同じ seed で一致する', () => {
    const a = buildUnits(item, 'ja-tr', { rng: mulberry32(7) })[0].chips
    const b = buildUnits(item, 'ja-tr', { rng: mulberry32(7) })[0].chips
    expect(a).toEqual(b)
  })
})
