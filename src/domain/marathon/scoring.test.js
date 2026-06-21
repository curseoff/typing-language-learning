import { describe, it, expect } from 'vitest'
import { score } from './scoring.js'

describe('score', () => {
  it('速度=文字数/分、正確率、秒を計算する', () => {
    const r = score({ keys: 600, mistakes: 0, elapsedMs: 60000 })
    expect(r.speed).toBe(600) // 600打 / 1分
    expect(r.accuracy).toBe(100)
    expect(r.seconds).toBe(60)
  })

  it('ミスを含めて正確率を出す', () => {
    const r = score({ keys: 90, mistakes: 10, elapsedMs: 60000 })
    expect(r.accuracy).toBe(90) // 90 / (90+10)
  })

  it('経過0なら速度0・正確率100', () => {
    const r = score({ keys: 0, mistakes: 0, elapsedMs: 0 })
    expect(r.speed).toBe(0)
    expect(r.accuracy).toBe(100)
  })
})
