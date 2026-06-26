import { describe, it, expect } from 'vitest'
import { makeSeed } from './seed.js'

describe('makeSeed', () => {
  it('0..2^32-1 の整数を返す', () => {
    for (let i = 0; i < 50; i++) {
      const s = makeSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(0x100000000)
    }
  })

  it('毎回ほぼ異なる値を返す（再現用の新しい問題列を切れる）', () => {
    const set = new Set(Array.from({ length: 100 }, () => makeSeed()))
    expect(set.size).toBeGreaterThan(90)
  })
})
