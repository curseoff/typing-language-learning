// @vitest-environment jsdom
// #432 P2P対戦：プレイフック（useDict/useWords/useMarathon）に足した任意コールバック onProgress の結合テスト。
// 打鍵のたびに手元の進捗スナップショット { typed, mistakes, segStats, currentMistakes } が通知され、
// 未指定時は従来どおり（呼ばれない＝後方互換）ことを確認する。対戦本体はこのスナップショットから
// correct（一発正解数）や lives（サドンデス残機）を組み立てて相手へ配信する。
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

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在セグメントを正しく打ち切る（正規表記＝canonical）。
const completeSeg = (result) => {
  const seg = result.current.segments[result.current.segIndex]
  if (!seg) return
  for (const ch of seg.canonical) {
    typeKey(ch)
    act(() => vi.advanceTimersByTime(5))
  }
}

const SEED = 30432

describe('useDict onProgress（#432 対戦・結合）', () => {
  it('打鍵のたびに typed/mistakes/segStats を通知し、正解問題は segStats に non-partial で積まれる', () => {
    const onProgress = vi.fn()
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {}, onProgress }),
    )
    completeSeg(result) // 1問完走
    expect(onProgress).toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)[0]
    expect(last.typed).toBeGreaterThan(0)
    expect(Array.isArray(last.segStats)).toBe(true)
    expect(last.segStats.some((s) => !s.partial)).toBe(true)
    expect(last.mistakes).toBe(0)
    expect(last.currentMistakes).toBe(0)
  }, 20000)

  it('ミスすると mistakes と currentMistakes が増える', () => {
    const onProgress = vi.fn()
    renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {}, onProgress }),
    )
    typeKey('1') // 定義に無いキー＝ミス
    const last = onProgress.mock.calls.at(-1)[0]
    expect(last.mistakes).toBe(1)
    expect(last.currentMistakes).toBe(1)
  })

  it('onProgress 未指定でも通常どおり動く（後方互換）', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, onExit: () => {} }),
    )
    expect(() => completeSeg(result)).not.toThrow()
  })
})

describe('useWords onProgress（#432 対戦・結合）', () => {
  it('打鍵のたびに segStats 付きスナップショットを通知する', () => {
    const onProgress = vi.fn()
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {}, onProgress }),
    )
    completeSeg(result)
    expect(onProgress).toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)[0]
    expect(last.typed).toBeGreaterThan(0)
    expect(Array.isArray(last.segStats)).toBe(true)
  }, 20000)
})

describe('useMarathon onProgress（#432 対戦・結合）', () => {
  it('start 後、打鍵のたびに segStats 付きスナップショットを通知する', () => {
    const onProgress = vi.fn()
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const { result } = renderHook(() =>
      useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze', onProgress }),
    )
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    completeSeg(result)
    expect(onProgress).toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)[0]
    expect(last.typed).toBeGreaterThan(0)
    expect(Array.isArray(last.segStats)).toBe(true)
  }, 20000)
})
