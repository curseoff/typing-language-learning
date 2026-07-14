// @vitest-environment jsdom
// #402 穴埋め学習モード（cloze）のマラソン結合テスト。learningMode='cloze' で
// 5問ブロック交互（normal→cloze）＝後半ブロックの打鍵対象 seg に文中伏字レンジ（clozeRanges）が付き、
// 問題数制は実効目標が2倍・cloze の問題でミスすると clozeRevealed が立ち、記録に learning='cloze' が載ることを確認する。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarathon } from './useMarathon.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
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
    act(() => vi.advanceTimersByTime(5))
  }
}

const pool = WORD_SENTENCES.filter((s) => s.level === 1)
const SEED = 20402

describe('useMarathon cloze（#402 穴埋め・結合）', () => {
  it('先頭5問ブロックは伏字なし・後半ブロックの打鍵対象 seg に clozeRanges が付く', () => {
    const { result } = renderHook(() =>
      useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze' }),
    )
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    const segs = result.current.segments
    // 先頭ブロック（sentenceIndex < 5）は伏字レンジを持たない。
    expect(segs.filter((s) => s.sentenceIndex < 5).every((s) => !s.clozeRanges)).toBe(true)
    // 後半ブロック（>=5）のどこかに clozeRanges（文中伏字）が付く。
    expect(segs.some((s) => s.sentenceIndex >= 5 && Array.isArray(s.clozeRanges) && s.clozeRanges.length > 0)).toBe(true)
  })

  it('同じ seed で clozeRanges を含む出題列が決定的に再現する', () => {
    const a = renderHook(() => useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze' }))
    act(() => a.result.current.start('en', 1, 'wsent', pool, SEED))
    const b = renderHook(() => useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze' }))
    act(() => b.result.current.start('en', 1, 'wsent', pool, SEED))
    const keyOf = (segs) => segs.map((s) => `${s.canonical}|${(s.clozeRanges ?? []).map((r) => `${r.start}-${r.end}`).join(',')}`)
    expect(keyOf(a.result.current.segments)).toEqual(keyOf(b.result.current.segments))
  })

  it('cloze の問題でミスすると clozeRevealed が立ち、その seg を打ち切ると戻る', () => {
    const { result } = renderHook(() =>
      useMarathon({ active: true, onFinish: vi.fn(), learningMode: 'cloze' }),
    )
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    expect(result.current.clozeRevealed).toBe(false)
    // わざと不正キー（数字）でミス → 開示。
    typeKey('1')
    expect(result.current.clozeRevealed).toBe(true)
    // その seg を打ち切ると次へ＝開示リセット。
    completeSeg(result)
    expect(result.current.clozeRevealed).toBe(false)
  }, 20000)

  it('60秒 finish で record.learning に cloze が載る', () => {
    const onFinish = vi.fn()
    const { result } = renderHook(() =>
      useMarathon({ active: true, onFinish, learningMode: 'cloze' }),
    )
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    for (let i = 0; i < 12; i++) completeSeg(result)
    runOutClock()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].learning).toBe('cloze')
  }, 20000)

  it('learningMode 未指定（normal）は clozeRanges を付けず clozeRevealed も立たない', () => {
    const onFinish = vi.fn()
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool, SEED))
    expect(result.current.segments.every((s) => !s.clozeRanges)).toBe(true)
    typeKey('1') // ミスしても normal では開示しない
    expect(result.current.clozeRevealed).toBe(false)
    for (let i = 0; i < 6; i++) completeSeg(result)
    runOutClock()
    // normal 記録は learning を載せない（後方互換）。
    expect(onFinish.mock.calls[0][0]).not.toHaveProperty('learning')
  }, 20000)
})
