// @vitest-environment jsdom
// #208 段3: 問題数制（items）の結合テスト（単語4択・クイズ系）。
// items=N で「時間ではなく解いた設問数」で終了し、記録に correctCount（一発正解数）を積む。
// correctCount の定義（クイズ系）= segStats.filter(s => s.correct && (s.mistakes ?? 0) === 0).length
//   ＝「正答した設問のうちタイプミス0のもの」。正答でも途中でミスした設問は数えない。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWordQuiz } from './useWordQuiz.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey, initMemoryPersistence } from './records.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence() // 記録メモリ像を空にリセット（sqlite専用化で facade は localStorage を読まない）
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })
const typeStr = (s) => [...s].forEach(typeKey)

const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

const correctOf = (q) => q.options.find((o) => o.answer)

// n 問を正解で解く。mistakeAt に指定した設問だけ、正解を打つ前に無効キーで1回タイプミスする
// （＝その設問は「正答だがミスあり」になる）。
const solveQuiz = (result, n, { mistakeAt = -1 } = {}) => {
  for (let i = 0; i < n; i++) {
    if (result.current.finished) break
    const q = result.current.question
    if (i === mistakeAt) {
      typeKey('1') // どの選択肢にも無い無効キー→タイプミス（この設問に帰属）
      act(() => vi.advanceTimersByTime(10))
    }
    typeStr(correctOf(q).variants[0])
    typeKey('Enter')
    act(() => vi.advanceTimersByTime(50))
  }
}

const opts = (endCondition) => ({
  words: WORDS,
  level: 1,
  theme: 'すべて',
  dir: 'en',
  mode: 'quiz-en',
  endCondition,
  onExit: () => {},
})

describe('useWordQuiz（単語4択・問題数制 items・#208 段3）', () => {
  it('items=3 は 3問解いた時点で finished になる（2問ではまだ false）', () => {
    const { result } = renderHook(() => useWordQuiz(opts({ kind: 'items', value: 3 })))
    solveQuiz(result, 2)
    expect(result.current.finished).toBe(false) // 2問ではまだ終わらない
    solveQuiz(result, 1)
    expect(result.current.finished).toBe(true) // 3問で終了
  })

  it('items 制は 60秒経過しても設問数に達しなければ終了しない（時間では終わらない）', () => {
    const { result } = renderHook(() => useWordQuiz(opts({ kind: 'items', value: 3 })))
    solveQuiz(result, 1)
    runOutClock()
    expect(result.current.finished).toBe(false)
  })

  it('correctCount は「正答かつミス0の設問数」＝1問だけミスありなら 3問中 2', () => {
    const { result } = renderHook(() => useWordQuiz(opts({ kind: 'items', value: 3 })))
    solveQuiz(result, 3, { mistakeAt: 1 }) // 2問目だけ正答だがタイプミスあり
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en', { kind: 'items', value: 3 })][0]
    expect(rec.correctCount).toBe(2) // ミスありの1問は数えない
    expect(rec.endCondition.kind).toBe('items')
    expect(rec.seconds).toEqual(expect.any(Number))
  })

  it('全問ノーミス正解なら correctCount は設問数と等しい（3問→3）', () => {
    const { result } = renderHook(() => useWordQuiz(opts({ kind: 'items', value: 3 })))
    solveQuiz(result, 3)
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en', { kind: 'items', value: 3 })][0]
    expect(rec.correctCount).toBe(3)
  })
})
