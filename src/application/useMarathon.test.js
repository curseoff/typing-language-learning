// @vitest-environment jsdom
// 単語例文（マラソン）の結合テスト。start で開始し canonical を打鍵してから、
// 最初の打鍵から60秒経過をシミュレートして onFinish(record, segStats) が呼ばれることを確認する。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarathon } from './useMarathon.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'
import { END_TIME_VALUES } from '../content/endConditions.js'

const ENDLESS = { kind: 'endless', value: null }
const MIN_RECORD_MS = END_TIME_VALUES[0] * 1000 // 記録に必要な最低プレイ時間（30秒）

// performance.now を fake timer に同期させ、時間経過を制御する。
beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 最初の打鍵から60秒経過させて時間切れ finish を発火させる。
// interval で now を進めて60秒effectを発火させ、続けて予約された setTimeout(finish) を flush する。
const runOutClock = () => {
  act(() => {
    vi.advanceTimersByTime(TIME_LIMIT_MS + 200)
  })
  act(() => {
    vi.runOnlyPendingTimers()
  })
}

// n 打だけ canonical を打つ（時間制なので完走はしない）。
const typeSome = (result, n) => {
  for (let i = 0; i < n; i++) {
    const seg = result.current.segments[result.current.segIndex]
    if (!seg) break
    typeKey(seg.canonical[result.current.segInput.length])
  }
}

describe('useMarathon（単語例文・結合）', () => {
  it('英語モードで打鍵後、60秒で onFinish が record と segStats つきで呼ばれる', () => {
    const onFinish = vi.fn()
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool))

    typeSome(result, 50)
    runOutClock()

    expect(onFinish).toHaveBeenCalledTimes(1)
    const [record, segStats] = onFinish.mock.calls[0]
    expect(record.source).toBe('wsent')
    expect(record.keys).toBeGreaterThan(0)
    expect(record.mistakes).toBe(0)
    expect(record.seconds).toBeCloseTo(60, 0) // 60秒固定
    expect(Array.isArray(segStats)).toBe(true)
    expect(segStats.length).toBeGreaterThan(0)
    expect(segStats[0]).toHaveProperty('speed')
  }, 20000)

  it('range を渡すと record.range に載り、pool 順（ordered）で決定的に出題する（#364）', () => {
    // App 側が range で freq 順スライス済みの pool を渡す前提。ここでは pool 順が seed 非依存で
    // 固定される（ordered）ことと record.range の往復を確認する。
    const pool = WORD_SENTENCES.filter((s) => s.level === 1).slice(0, 30)
    const onFinish = vi.fn()
    const a = renderHook(() => useMarathon({ active: true, onFinish: vi.fn() }))
    act(() => a.result.current.start('en', 1, 'wsent', pool, 111, 'すべて', 2))
    const b = renderHook(() => useMarathon({ active: true, onFinish: vi.fn() }))
    act(() => b.result.current.start('en', 1, 'wsent', pool, 999, 'すべて', 2))
    // seed が違っても range 出題は同一（rng シャッフルせず pool 順）。
    expect(a.result.current.segments.map((s) => s.canonical)).toEqual(
      b.result.current.segments.map((s) => s.canonical),
    )

    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool, undefined, 'すべて', 2))
    typeSome(result, 30)
    runOutClock()
    expect(onFinish.mock.calls[0][0].range).toBe(2)
  }, 20000)

  it('range 未指定なら record に range を載せない（後方互換・#364）', () => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const onFinish = vi.fn()
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool))
    typeSome(result, 30)
    runOutClock()
    expect(onFinish.mock.calls[0][0]).not.toHaveProperty('range')
  }, 20000)

  it('seed を渡すと同じ問題列を再現し record に seed が入る（リプレイ）', () => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const seed = 424242

    const a = renderHook(() => useMarathon({ active: true, onFinish: vi.fn() }))
    act(() => a.result.current.start('en', 1, 'wsent', pool, seed))
    const b = renderHook(() => useMarathon({ active: true, onFinish: vi.fn() }))
    act(() => b.result.current.start('en', 1, 'wsent', pool, seed))

    // 同じ seed なら出題セグメント列が一致する
    const labelsA = a.result.current.segments.map((s) => s.canonical)
    const labelsB = b.result.current.segments.map((s) => s.canonical)
    expect(labelsA).toEqual(labelsB)
    expect(labelsA.length).toBeGreaterThan(0)

    // 打鍵→60秒で record.seed が記録されることを確認
    const onFinish = vi.fn()
    const { result } = renderHook(() => useMarathon({ active: true, onFinish }))
    act(() => result.current.start('en', 1, 'wsent', pool, seed))
    typeSome(result, 30)
    runOutClock()
    expect(onFinish.mock.calls[0][0].seed).toBe(seed)
  }, 20000)
})

// #208 段6：エンドレスは App の ESC ハンドラから escFinish() を呼ぶ。30秒以上プレイした時だけ記録する。
describe('useMarathon エンドレス（#208 段6：escFinish は30秒以上で記録）', () => {
  const startEndless = (onFinish) => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const hook = renderHook(() => useMarathon({ active: true, onFinish, endCondition: ENDLESS }))
    act(() => hook.result.current.start('en', 1, 'wsent', pool))
    return hook
  }

  it('経過<30秒の escFinish は false を返し記録しない（中断は呼び出し側）', () => {
    const onFinish = vi.fn()
    const { result } = startEndless(onFinish)
    typeSome(result, 5) // startTime 確定
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS - 100)) // 29.9秒
    let recorded
    act(() => {
      recorded = result.current.escFinish()
    })
    expect(recorded).toBe(false)
    expect(onFinish).not.toHaveBeenCalled()
  }, 20000)

  it('経過>=30秒の escFinish は true を返し onFinish で記録する（速度が成績）', () => {
    const onFinish = vi.fn()
    const { result } = startEndless(onFinish)
    typeSome(result, 5)
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS)) // 30秒
    let recorded
    act(() => {
      recorded = result.current.escFinish()
    })
    expect(recorded).toBe(true)
    expect(onFinish).toHaveBeenCalledTimes(1)
    const record = onFinish.mock.calls[0][0]
    expect(record.endCondition.kind).toBe('endless')
    expect(record.speed).toEqual(expect.any(Number))
  }, 20000)

  it('未打鍵（startTime 未確定）の escFinish は false（経過0扱い）', () => {
    const onFinish = vi.fn()
    const { result } = startEndless(onFinish)
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS * 2)) // 打鍵せず時間だけ進める
    let recorded
    act(() => {
      recorded = result.current.escFinish()
    })
    expect(recorded).toBe(false)
    expect(onFinish).not.toHaveBeenCalled()
  }, 20000)
})
