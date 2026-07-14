// @vitest-environment jsdom
// #402 穴埋め学習モード（cloze）の英英入力（useDict）結合テスト。learningMode='cloze' で
// 5問ブロック交互（normal→cloze）＝後半ブロックの打鍵対象 seg に文中伏字レンジ（clozeRanges）が付き、
// cloze の問題でミスすると clozeRevealed が立ち、記録に learning='cloze' が載ることを確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDict } from './useDict.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey, initMemoryPersistence } from './records.service.js'

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

const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

const completeSeg = (result) => {
  const seg = result.current.segments[result.current.segIndex]
  if (!seg) return
  for (const ch of seg.canonical) {
    typeKey(ch)
    act(() => vi.advanceTimersByTime(10))
  }
}

const SEED = 30402

describe('useDict cloze（#402 穴埋め・結合）', () => {
  it('先頭5問ブロックは伏字なし・後半ブロックの打鍵対象 seg に clozeRanges が付く', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    const segs = result.current.segments
    expect(segs.filter((s) => s.sentenceIndex < 5).every((s) => !s.clozeRanges)).toBe(true)
    expect(segs.some((s) => s.sentenceIndex >= 5 && Array.isArray(s.clozeRanges) && s.clozeRanges.length > 0)).toBe(true)
  })

  it('cloze の問題でミスすると clozeRevealed が立ち、その seg を打ち切ると戻る', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    expect(result.current.clozeRevealed).toBe(false)
    typeKey('1') // 不正キーでミス
    expect(result.current.clozeRevealed).toBe(true)
    completeSeg(result)
    expect(result.current.clozeRevealed).toBe(false)
  }, 20000)

  it('60秒 finish で record.learning に cloze が載る', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, endCondition: { kind: 'time', value: 60 }, learningMode: 'cloze', onExit: () => {} }),
    )
    for (let i = 0; i < 40; i++) completeSeg(result)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'en', { kind: 'time', value: 60 })][0]
    expect(rec.learning).toBe('cloze')
  }, 20000)

  it('learningMode 未指定（normal）は clozeRanges を付けず clozeRevealed も立たない', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, onExit: () => {} }),
    )
    expect(result.current.segments.every((s) => !s.clozeRanges)).toBe(true)
    typeKey('1')
    expect(result.current.clozeRevealed).toBe(false)
  })
})
