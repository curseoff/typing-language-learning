import { describe, it, expect } from 'vitest'
import { mulberry32 } from './rng.js'

describe('mulberry32', () => {
  it('同じ seed からは同じ乱数列を返す（決定的）', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('異なる seed では異なる乱数列になる', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a()).not.toBe(b())
  })

  it('0..1 の範囲の値を返す', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 100; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('既知の seed に対する値が安定している（リグレッション固定）', () => {
    const r = mulberry32(0)
    // 実装を変えると問題列の再現が壊れるため、先頭値を固定する
    expect(r()).toBeCloseTo(0.26642920868471265, 12)
  })
})
