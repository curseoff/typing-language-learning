// @vitest-environment jsdom
// 英英4択クイズの結合テスト。打鍵で数問解いてから60秒経過をシミュレートして finish させ、
// record と segStats を確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDictQuiz } from './useDictQuiz.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey } from '../infrastructure/dictRepository.js'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

const solve = (result, n) => {
  for (let i = 0; i < n; i++) {
    if (result.current.finished) break
    const correct = result.current.question.options.find((o) => o.answer)
    ;[...correct.variants[0]].forEach(typeKey) // 正解の見出し語を打つ
    typeKey('Enter')
    act(() => vi.advanceTimersByTime(50))
  }
}

describe('useDictQuiz（英英4択・60秒・結合）', () => {
  it('正解を打って数問解き、60秒で finish。record と segStats(全問正解) を保存する', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', onExit: () => {} }),
    )
    solve(result, 6)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.correct).toBe(rec.words)
    expect(rec.seconds).toBeCloseTo(60, 0)
    expect(rec.segStats).toHaveLength(rec.words)
    expect(rec.segStats.every((s) => s.correct === true)).toBe(true)
  })

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', onExit: () => {} }),
    )
    solve(result, 4)
    runOutClock()
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('dict')
  })

  it('同じ seed なら同じ出題・選択肢を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 369121
    const opts = { dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', seed, onExit: () => {} }
    const a = renderHook(() => useDictQuiz(opts))
    const b = renderHook(() => useDictQuiz(opts))
    expect(a.result.current.question.prompt).toBe(b.result.current.question.prompt)
    expect(a.result.current.question.options.map((o) => o.display)).toEqual(
      b.result.current.question.options.map((o) => o.display),
    )

    const { result } = renderHook(() => useDictQuiz(opts))
    solve(result, 4)
    runOutClock()
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('dict')
  })
})
