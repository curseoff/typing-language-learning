import { describe, it, expect } from 'vitest'
import { buildUnits, scramble, segMatches } from './units.js'

const item = { en: 'reserve', ja: '予約する', kana: 'よやくする', jaWords: ['予約', 'する'] }

// テスト用シード付き PRNG（mulberry32）。同じ seed で同じ乱数列を返す。
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
