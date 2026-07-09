// @vitest-environment jsdom
// 4択クイズ（単語）の結合テスト。打鍵で何問か解いてから60秒経過をシミュレートして finish させ、
// 記録(record)と問題ごとの記録(segStats)が正しく保存されることを確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWordQuiz } from './useWordQuiz.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { WORDS } from '../content/wordsAll.js'
import { END_TIME_VALUES } from '../content/endConditions.js'
import { loadWordRecords, wordRecKey, initMemoryPersistence } from './records.js'

const ENDLESS = { kind: 'endless', value: null }
const MIN_RECORD_MS = END_TIME_VALUES[0] * 1000 // 記録に必要な最低プレイ時間（30秒）

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

// n 問だけ pickChoice(question)→正解を打って Enter で進める。
const solve = (result, n, pickChoice) => {
  for (let i = 0; i < n; i++) {
    if (result.current.finished) break
    const q = result.current.question
    const opt = pickChoice(q, i)
    typeStr(opt.variants[0])
    typeKey('Enter')
    act(() => vi.advanceTimersByTime(50))
  }
}

const correctOf = (q) => q.options.find((o) => o.answer)

describe('useWordQuiz（4択・60秒・結合）', () => {
  it('正解を打って数問解き、60秒で finish。record と segStats(全問正解) を保存する', () => {
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', onExit: () => {} }),
    )
    solve(result, 8, correctOf)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.keys).toBeGreaterThan(0) // タイピング数が主指標
    expect(rec.correct).toBe(rec.words) // 全問正解
    expect(rec.accuracy).toBe(100)
    expect(rec.seconds).toBeCloseTo(60, 0)
    expect(rec.segStats).toHaveLength(rec.words)
    expect(rec.segStats.every((s) => s.correct === true)).toBe(true)
    expect(rec.segStats[0]).toHaveProperty('label')
    expect(rec.segStats[0]).toHaveProperty('answer')
  })

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', onExit: () => {} }),
    )
    solve(result, 5, correctOf)
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('word')
  })

  it('不正解の選択肢を打つと、その設問の segStats.correct が false になる', () => {
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', onExit: () => {} }),
    )
    // 1問目だけわざと不正解、以降は正解
    solve(result, 6, (q, i) => (i === 0 ? q.options.find((o) => !o.answer) : correctOf(q)))
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.segStats[0].correct).toBe(false)
    expect(rec.correct).toBe(rec.words - 1)
  })

  it('同じ seed なら同じ出題・選択肢を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 135790
    const opts = { words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', seed, onExit: () => {} }
    const a = renderHook(() => useWordQuiz(opts))
    const b = renderHook(() => useWordQuiz(opts))
    // 出題列（prompt）と各問の選択肢表示が一致する
    const sigA = a.result.current
    const sigB = b.result.current
    expect(sigA.question.prompt).toBe(sigB.question.prompt)
    expect(sigA.question.options.map((o) => o.display)).toEqual(
      sigB.question.options.map((o) => o.display),
    )

    const { result } = renderHook(() => useWordQuiz(opts))
    solve(result, 5, correctOf)
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('word')
  })
})

// #208 段6：エンドレスは ESC で終了。30秒以上プレイした時だけ記録する。
const pressEscape = () => typeKey('Escape')

describe('useWordQuiz エンドレス（#208 段6：ESC・30秒以上で記録）', () => {
  it('経過<30秒で ESC したら記録せず onExit（中断＝TOPへ）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', endCondition: ENDLESS, onExit }),
    )
    solve(result, 1, correctOf) // startTime 確定
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS - 100)) // 29.9秒
    pressEscape()
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(result.current.finished).toBe(false)
    expect(loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en', ENDLESS)] ?? []).toEqual([])
  }, 20000)

  it('経過>=30秒で ESC したら finished になり記録される（速度が成績）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', endCondition: ENDLESS, onExit }),
    )
    solve(result, 3, correctOf)
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS)) // 30秒
    pressEscape()
    expect(result.current.finished).toBe(true)
    expect(onExit).not.toHaveBeenCalled()
    const list = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en', ENDLESS)]
    expect(list.length).toBe(1)
    expect(list[0].endCondition.kind).toBe('endless')
    expect(list[0].speed).toEqual(expect.any(Number))
  }, 20000)
})
