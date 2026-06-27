// @vitest-environment jsdom
// 単語入力モードの結合テスト。canonical を打鍵してから60秒経過をシミュレートして finish させ、
// record と問題ごとの記録(segStats=各語の速度/ミス) を確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey } from '../infrastructure/wordsRepository.js'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 最初の打鍵から60秒経過させて finish を発火させる。
const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

// n 文字ぶん canonical を打つ（時間制なので完走はしない）。
// 各打鍵の間に少し時間を進め、語ごとの speed が 0 にならないようにする。
const typeSome = (result, n) => {
  for (let i = 0; i < n; i++) {
    const seg = result.current.segments[result.current.segIndex]
    if (!seg) break
    typeKey(seg.canonical[result.current.segInput.length])
    act(() => vi.advanceTimersByTime(10))
  }
}

describe('useWords（単語入力・結合）', () => {
  it('英語モードで打鍵後、60秒で finish し record と segStats を保存する', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    typeSome(result, 60)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.mistakes).toBe(0) // 正打のみ
    expect(rec.accuracy).toBe(100)
    expect(rec.speed).toBeGreaterThan(0)
    expect(rec.seconds).toBeCloseTo(60, 0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    expect(rec.segStats[0]).toMatchObject({ type: 'en' })
    expect(rec.segStats[0].speed).toBeGreaterThan(0)
  }, 20000)

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    typeSome(result, 30)
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.seed).toEqual(expect.any(Number)) // null ではなく有効な seed
    expect(rec.source).toBe('word')
  }, 20000)

  it('restart は新しい seed を切り直して別の問題列にする（record の seed が変わる）', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    typeSome(result, 30)
    runOutClock()
    const first = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0].seed
    act(() => result.current.restart())
    typeSome(result, 30)
    runOutClock()
    const seeds = loadWordRecords()[wordRecKey(1, 'すべて', 'en')].map((r) => r.seed)
    expect(seeds).toContain(first)
    // 2件の seed が別物（=別の問題列）であること
    expect(new Set(seeds).size).toBe(2)
  }, 20000)

  it('間違ったキーはミスとして数えられる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    // 現在語の正しい次の文字でないキー（数字）を打つ→ミス
    const before = result.current.mistakes
    typeKey('1')
    expect(result.current.mistakes).toBe(before + 1)
    expect(result.current.hasError).toBe(true)
  })

  it('同じ seed なら同じ単語列を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 987654
    const opts = { allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', seed, onExit: () => {} }
    const a = renderHook(() => useWords(opts))
    const b = renderHook(() => useWords(opts))
    const labelsA = a.result.current.segments.map((s) => s.canonical)
    const labelsB = b.result.current.segments.map((s) => s.canonical)
    expect(labelsA).toEqual(labelsB)
    expect(labelsA.length).toBeGreaterThan(0)

    // 打鍵→60秒で record.seed が記録されることを確認
    const { result } = renderHook(() => useWords(opts))
    typeSome(result, 30)
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('word')
  }, 20000)
})
