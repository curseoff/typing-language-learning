import { describe, it, expect } from 'vitest'
import { buildDrill, TOUCH_COUNT } from './drill.js'

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

const KEYS = ['f', 'j', 'd', 'k', 's', 'l']

describe('buildDrill', () => {
  it('count 個の打鍵列を返す（既定 TOUCH_COUNT）', () => {
    expect(buildDrill(KEYS).length).toBe(TOUCH_COUNT)
    expect(buildDrill(KEYS, 10).length).toBe(10)
  })

  it('同キーの連続を避ける（キーが2種以上あるとき）', () => {
    const out = buildDrill(KEYS, 100, { rng: mulberry32(1) })
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).not.toBe(out[i - 1])
    }
  })

  it('キーが1種だけなら連続回避はせずそのキーが並ぶ', () => {
    expect(buildDrill(['f'], 5)).toEqual(['f', 'f', 'f', 'f', 'f'])
  })

  it('同じ seed の rng で同じ打鍵列を返す（決定的）', () => {
    const a = buildDrill(KEYS, 40, { rng: mulberry32(42) })
    const b = buildDrill(KEYS, 40, { rng: mulberry32(42) })
    expect(a).toEqual(b)
  })

  it('seed が違えば打鍵列が変わる', () => {
    const a = buildDrill(KEYS, 40, { rng: mulberry32(1) })
    const b = buildDrill(KEYS, 40, { rng: mulberry32(2) })
    expect(a).not.toEqual(b)
  })
})
