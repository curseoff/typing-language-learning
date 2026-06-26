import { describe, it, expect } from 'vitest'
import { buildDrill, TOUCH_COUNT } from './drill.js'
import { mulberry32 } from '../rng.js'

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
