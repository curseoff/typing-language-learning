// @vitest-environment jsdom
// 英英4択クイズの結合テスト。打鍵で数問解いてから60秒経過をシミュレートして finish させ、
// record と segStats を確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDictQuiz } from './useDictQuiz.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { DICT } from '../content/dictionaryAll.js'
import { WORDS } from '../content/wordsAll.js'
import { END_TIME_VALUES } from '../content/endConditions.js'
import { loadDictRecords, dictRecKey, initMemoryPersistence } from './records.service.js'

// #364 range 出題用の freqMap（見出し語 en→freq）。dict は freq を持たないため単語データから作る。
const FREQ_MAP = new Map(WORDS.map((w) => [w.en, w.freq]))

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

  it('range 指定時は範囲別キー（__R{n}）に記録し record.range を載せる（#364）', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', range: 1, freqMap: FREQ_MAP, onExit: () => {} }),
    )
    solve(result, 4)
    runOutClock()
    const ranged = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz', undefined, 1)]
    expect(ranged?.length).toBeGreaterThan(0)
    expect(ranged[0].range).toBe(1)
    // range 未指定は record に range を載せない（後方互換）。
    expect(loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')]).toBeUndefined()
  })

  it('range 指定は freq 順で決定的＝同 range なら seed 非依存で同じ出題列（#364）', () => {
    const opts = { dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', range: 1, freqMap: FREQ_MAP, onExit: () => {} }
    const a = renderHook(() => useDictQuiz({ ...opts, seed: 111 }))
    const b = renderHook(() => useDictQuiz({ ...opts, seed: 999 }))
    // seed が違っても range 出題は同一の prompt 列（freq 順固定・rng 不使用）。
    expect(a.result.current.question.prompt).toBe(b.result.current.question.prompt)
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

// #208 段6：エンドレスは ESC で終了。30秒以上プレイした時だけ記録する。
const pressEscape = () => typeKey('Escape')

describe('useDictQuiz エンドレス（#208 段6：ESC・30秒以上で記録）', () => {
  it('経過<30秒で ESC したら記録せず onExit（中断＝TOPへ）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', endCondition: ENDLESS, onExit }),
    )
    solve(result, 1) // startTime 確定
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS - 100)) // 29.9秒
    pressEscape()
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(result.current.finished).toBe(false)
    expect(loadDictRecords()[dictRecKey(1, 'すべて', 'quiz', ENDLESS)] ?? []).toEqual([])
  }, 20000)

  it('経過>=30秒で ESC したら finished になり記録される（速度が成績）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', endCondition: ENDLESS, onExit }),
    )
    solve(result, 3)
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS)) // 30秒
    pressEscape()
    expect(result.current.finished).toBe(true)
    expect(onExit).not.toHaveBeenCalled()
    const list = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz', ENDLESS)]
    expect(list.length).toBe(1)
    expect(list[0].endCondition.kind).toBe('endless')
    expect(list[0].speed).toEqual(expect.any(Number))
  }, 20000)
})
