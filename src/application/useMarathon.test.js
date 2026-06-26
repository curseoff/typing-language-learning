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
})
