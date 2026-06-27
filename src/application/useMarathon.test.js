// @vitest-environment jsdom
// 単語例文（マラソン）の結合テスト。start で開始し canonical を打鍵してから、
// 最初の打鍵から60秒経過をシミュレートして onFinish(record, segStats) が呼ばれることを確認する。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarathon } from './useMarathon.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'

// performance.now を fake timer に同期させ、時間経過を制御する。
beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 最初の打鍵から60秒経過させて時間切れ finish を発火させる。
// interval で now を進めて60秒effectを発火させ、続けて予約された setTimeout(finish) を flush する。
const runOutClock = () => {
  act(() => {
    vi.advanceTimersByTime(TIME_LIMIT_MS + 200)
  })
  act(() => {
    vi.runOnlyPendingTimers()
  })
}

// n 打だけ canonical を打つ（時間制なので完走はしない）。
const typeSome = (result, n) => {
  for (let i = 0; i < n; i++) {
    const seg = result.current.segments[result.current.segIndex]
    if (!seg) break
    typeKey(seg.canonical[result.current.segInput.length])
  }
}

describe('useMarathon（単語例文・結合）', () => {
  it('英語モードで打鍵後、60秒で onFinish が record と segStats つきで呼ばれる', () => {
    const onFinish = vi.fn()
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool))

    typeSome(result, 50)
    runOutClock()

    expect(onFinish).toHaveBeenCalledTimes(1)
    const [record, segStats] = onFinish.mock.calls[0]
    expect(record.source).toBe('wsent')
    expect(record.keys).toBeGreaterThan(0)
    expect(record.mistakes).toBe(0)
    expect(record.seconds).toBeCloseTo(60, 0) // 60秒固定
    expect(Array.isArray(segStats)).toBe(true)
    expect(segStats.length).toBeGreaterThan(0)
    expect(segStats[0]).toHaveProperty('speed')
  }, 20000)

  it('seed を渡すと同じ問題列を再現し record に seed が入る（リプレイ）', () => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const seed = 424242

    const a = renderHook(() => useMarathon({ active: true, onFinish: vi.fn() }))
    act(() => a.result.current.start('en', 1, 'wsent', pool, seed))
    const b = renderHook(() => useMarathon({ active: true, onFinish: vi.fn() }))
    act(() => b.result.current.start('en', 1, 'wsent', pool, seed))

    // 同じ seed なら出題セグメント列が一致する
    const labelsA = a.result.current.segments.map((s) => s.canonical)
    const labelsB = b.result.current.segments.map((s) => s.canonical)
    expect(labelsA).toEqual(labelsB)
    expect(labelsA.length).toBeGreaterThan(0)

    // 打鍵→60秒で record.seed が記録されることを確認
    const onFinish = vi.fn()
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool, seed))
    typeSome(result, 30)
    runOutClock()
    expect(onFinish.mock.calls[0][0].seed).toBe(seed)
  }, 20000)
})
