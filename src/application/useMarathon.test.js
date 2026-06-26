// @vitest-environment jsdom
// 単語例文（マラソン）の結合テスト。start で開始し canonical を打鍵して完走させ、
// onFinish(record, segStats) が呼ばれ、segStats に各文の記録が積まれることを確認する。
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarathon } from './useMarathon.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

describe('useMarathon（単語例文・結合）', () => {
  it('英語モードで完走し onFinish が record と segStats つきで呼ばれる', () => {
    const onFinish = vi.fn()
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool))

    let n = 0
    while (!onFinish.mock.calls.length && n < 2000) {
      const seg = result.current.segments[result.current.segIndex]
      if (!seg) break
      typeKey(seg.canonical[result.current.segInput.length])
      n++
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    const [record, segStats] = onFinish.mock.calls[0]
    expect(record.source).toBe('wsent')
    expect(record.speed).toBeGreaterThan(0)
    expect(record.mistakes).toBe(0)
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

    // 完走させて record.seed が記録されることを確認
    const onFinish = vi.fn()
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool, seed))
    let n = 0
    while (!onFinish.mock.calls.length && n < 2000) {
      const seg = result.current.segments[result.current.segIndex]
      if (!seg) break
      typeKey(seg.canonical[result.current.segInput.length])
      n++
    }
    expect(onFinish.mock.calls[0][0].seed).toBe(seed)
  }, 20000)
})
