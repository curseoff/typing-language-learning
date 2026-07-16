// @vitest-environment jsdom
// #432 P2P対戦：プレイフック（useDict/useWords/useMarathon）に足した任意 prop autoStart の結合テスト。
// autoStart=true のときは初回打鍵を待たず、マウント（レース開始＝カウントダウン終了）と同時に計時が始まる
// （elapsedSec が打鍵ゼロでも進む）。未指定（solo プレイ）は従来どおり初回打鍵まで 0 のまま＝後方互換。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDict } from './useDict.js'
import { useWords } from './useWords.js'
import { useMarathon } from './useMarathon.js'
import { DICT } from '../content/dictionaryAll.js'
import { WORDS } from '../content/wordsAll.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'
import { initMemoryPersistence } from './records.service.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const SEED = 30432

describe('useDict autoStart（#432 対戦・結合）', () => {
  it('autoStart=true は打鍵ゼロでもマウント直後から elapsedSec が進む', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {}, autoStart: true }),
    )
    expect(result.current.elapsedSec).toBe(0) // まだ now は 0（interval 未経過）
    act(() => vi.advanceTimersByTime(300)) // 打鍵せずに時間だけ進める
    expect(result.current.elapsedSec).toBeGreaterThan(0)
  })

  it('autoStart 未指定は初回打鍵まで elapsedSec が 0（後方互換）', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.elapsedSec).toBe(0) // 打鍵していないので計時は始まらない
  })
})

describe('useWords autoStart（#432 対戦・結合）', () => {
  it('autoStart=true は打鍵ゼロでもマウント直後から elapsedSec が進む', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {}, autoStart: true }),
    )
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.elapsedSec).toBeGreaterThan(0)
  })

  it('autoStart 未指定は初回打鍵まで elapsedSec が 0（後方互換）', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.elapsedSec).toBe(0)
  })
})

describe('useMarathon autoStart（#432 対戦・結合）', () => {
  it('autoStart=true は start 後の打鍵ゼロでもマウント直後から elapsedSec が進む', () => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const { result } = renderHook(() =>
      useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze', autoStart: true }),
    )
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.elapsedSec).toBeGreaterThan(0)
  })

  it('autoStart 未指定は初回打鍵まで elapsedSec が 0（後方互換）', () => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const { result } = renderHook(() => useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze' }))
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.elapsedSec).toBe(0)
  })
})
