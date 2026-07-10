// @vitest-environment jsdom
// #208 段3: 問題数制（items）の結合テスト（単語入力・入力系）。
// items=N で「時間ではなく完答した問題数」で終了し、記録に correctCount（一発正解数）を積む。
// correctCount の定義（入力系）= segStats.filter(s => !s.partial && (s.mistakes ?? 0) === 0).length
//   ＝「完了(非partial)かつミス0の問題」。途中でミスした完答問題は数えない。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey, initMemoryPersistence } from './records.service.js'

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

// 60秒経過をシミュレート（items 制なら時間では終わらないことの確認に使う）。
const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

// 現在語を canonical で最後まで打って完答する（1語=1問）。
// withMistake=true なら語頭で無効キー（数字）を1回打ち、その語にタイプミスを帰属させる。
const completeWord = (result, { withMistake = false } = {}) => {
  const startIdx = result.current.segIndex
  if (withMistake) {
    typeKey('1') // 無効キー→ミス（この語に帰属。語は進まない）
    act(() => vi.advanceTimersByTime(10))
  }
  let guard = 0
  while (result.current.segIndex === startIdx && !result.current.finished && guard < 100) {
    const seg = result.current.segments[result.current.segIndex]
    const pos = result.current.segInput.length
    typeKey(seg.canonical[pos])
    act(() => vi.advanceTimersByTime(10))
    guard++
  }
}

const opts = (endCondition) => ({
  allWords: WORDS,
  level: 1,
  theme: 'すべて',
  mode: 'en',
  endCondition,
  onExit: () => {},
})

describe('useWords（単語入力・問題数制 items・#208 段3）', () => {
  it('items=3 は 3問完答した時点で finished になる（2問ではまだ false）', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'items', value: 3 })))
    completeWord(result)
    expect(result.current.finished).toBe(false)
    completeWord(result)
    expect(result.current.finished).toBe(false) // 2問ではまだ終わらない
    completeWord(result)
    expect(result.current.finished).toBe(true) // 3問完答で終了
  }, 20000)

  it('items 制は 60秒経過しても問題数に達しなければ終了しない（時間では終わらない）', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'items', value: 3 })))
    completeWord(result) // 1問だけ完答
    runOutClock()
    expect(result.current.finished).toBe(false)
  }, 20000)

  it('correctCount は「完了かつミス0の問題数」＝1問だけミスありなら 3問中 2', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'items', value: 3 })))
    completeWord(result) // 1問目: ノーミス
    completeWord(result, { withMistake: true }) // 2問目: タイプミスあり
    completeWord(result) // 3問目: ノーミス → finish
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en', { kind: 'items', value: 3 })][0]
    expect(rec.correctCount).toBe(2) // ミスありの1問は数えない
    expect(rec.endCondition.kind).toBe('items')
    expect(rec.seconds).toEqual(expect.any(Number))
  }, 20000)

  it('全問ノーミスなら correctCount は問題数と等しい（3問→3）', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'items', value: 3 })))
    completeWord(result)
    completeWord(result)
    completeWord(result)
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en', { kind: 'items', value: 3 })][0]
    expect(rec.correctCount).toBe(3)
  }, 20000)
})
