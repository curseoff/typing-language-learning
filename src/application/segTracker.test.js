import { describe, it, expect } from 'vitest'
import { newSegTracker, segMark, segMiss, segPush } from './segTracker.js'

describe('segTracker（問題ごとの記録）', () => {
  it('セグメント完了で1件積み、type/label/keys/ミス/秒/速度を持つ', () => {
    const tr = newSegTracker()
    segMark(tr, 1000) // 最初の打鍵
    segMiss(tr)
    segMiss(tr)
    segPush(tr, { type: 'en', label: 'good', keys: 4, t: 1000 + 60000 }) // 60秒で4打
    expect(tr.list).toHaveLength(1)
    const s = tr.list[0]
    expect(s.no).toBe(1)
    expect(s.type).toBe('en')
    expect(s.label).toBe('good')
    expect(s.keys).toBe(4)
    expect(s.mistakes).toBe(2)
    expect(s.seconds).toBe(60)
    expect(s.speed).toBe(4) // 4打 / 1分
    expect(s.partial).toBe(false)
  })

  it('segMark は最初の打鍵時刻のみ採用し、push 後はミス/開始がリセットされる', () => {
    const tr = newSegTracker()
    segMark(tr, 500)
    segMark(tr, 900) // 無視される（既に開始済み）
    expect(tr.start).toBe(500)
    segPush(tr, { type: 'ja', label: '良い', keys: 3, t: 500 + 30000, partial: true })
    expect(tr.start).toBeNull()
    expect(tr.mistakes).toBe(0)
    expect(tr.list[0].partial).toBe(true)
    // 2件目は連番
    segMark(tr, 100000)
    segPush(tr, { type: 'en', label: 'next', keys: 4, t: 100000 + 12000 })
    expect(tr.list[1].no).toBe(2)
  })
})
