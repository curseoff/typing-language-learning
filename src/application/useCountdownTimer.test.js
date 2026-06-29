// @vitest-environment jsdom
// 共通フック useCountdownTimer の単体テスト。
// active の間だけ now を 100ms 間隔で刻み、最初の打鍵時刻(startTime)から
// TIME_LIMIT_MS(=60秒)到達で onTimeout を1回だけ発火させる。
// 経過秒(elapsedSec)とライブ速度(liveSpeed)も派生して返す。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdownTimer } from './useCountdownTimer.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'

// performance.now を fake timer に同期させ、時間経過を制御する。
beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
afterEach(() => vi.useRealTimers())

// 60秒分(＋余白)進めて60秒effectを発火させ、続けて予約された setTimeout(…,0) を flush する。
const runOutClock = () => {
  act(() => {
    vi.advanceTimersByTime(TIME_LIMIT_MS + 200)
  })
  act(() => {
    vi.runOnlyPendingTimers()
  })
}

describe('useCountdownTimer（カウントダウン共通フック）', () => {
  it('active かつ startTime ありで60秒到達すると onTimeout が1回だけ呼ばれる', () => {
    const onTimeout = vi.fn()
    renderHook(() => useCountdownTimer({ active: true, startTime: 0, onTimeout }))

    runOutClock()

    expect(onTimeout).toHaveBeenCalledTimes(1)
    // endTime = startTime + TIME_LIMIT_MS, startedAt = startTime
    expect(onTimeout).toHaveBeenCalledWith(TIME_LIMIT_MS, 0)
  })

  it('startTime が任意の数値でも endTime=startTime+60000, startedAt=startTime で呼ばれる', () => {
    const onTimeout = vi.fn()
    const startTime = 5000
    renderHook(() => useCountdownTimer({ active: true, startTime, onTimeout }))

    // 発火条件は相対基点（now - startTime >= TIME_LIMIT_MS）。
    // performance.now は 0 起点なので startTime 分も足して進める。
    act(() => {
      vi.advanceTimersByTime(startTime + TIME_LIMIT_MS + 200)
    })
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(onTimeout).toHaveBeenCalledWith(startTime + TIME_LIMIT_MS, startTime)
  })

  it('60秒未満（50秒）では onTimeout は呼ばれない', () => {
    const onTimeout = vi.fn()
    renderHook(() => useCountdownTimer({ active: true, startTime: 0, onTimeout }))

    act(() => {
      vi.advanceTimersByTime(50000)
    })
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('active=false なら60秒以上進めても onTimeout は呼ばれない', () => {
    const onTimeout = vi.fn()
    renderHook(() => useCountdownTimer({ active: false, startTime: 0, onTimeout }))

    runOutClock()

    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('startTime=null（未開始）なら時間を進めても onTimeout は呼ばれない', () => {
    const onTimeout = vi.fn()
    renderHook(() => useCountdownTimer({ active: true, startTime: null, onTimeout }))

    runOutClock()

    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('startTime を null に戻してから再設定すると（再武装）再び発火し計2回呼ばれる', () => {
    const onTimeout = vi.fn()
    const { result, rerender } = renderHook(
      ({ active, startTime }) => useCountdownTimer({ active, startTime, onTimeout }),
      { initialProps: { active: true, startTime: 0 } },
    )

    // 1回目の発火
    runOutClock()
    expect(onTimeout).toHaveBeenCalledTimes(1)

    // startTime を null に戻して武装解除
    rerender({ active: true, startTime: null })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // 現在の now を新しい開始時刻として再設定（restart 相当）
    const restart = result.current.now
    rerender({ active: true, startTime: restart })

    runOutClock()
    expect(onTimeout).toHaveBeenCalledTimes(2)
    expect(onTimeout).toHaveBeenLastCalledWith(restart + TIME_LIMIT_MS, restart)
  })

  it('elapsedSec は startTime=0 で30秒進めると約30、startTime=null では0', () => {
    const { result, rerender } = renderHook(
      ({ active, startTime }) => useCountdownTimer({ active, startTime, onTimeout: vi.fn() }),
      { initialProps: { active: true, startTime: 0 } },
    )

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(result.current.elapsedSec).toBeCloseTo(30, 0)

    rerender({ active: true, startTime: null })
    expect(result.current.elapsedSec).toBe(0)
  })

  it('liveSpeed(count) は startTime=0 で30秒(0.5分)経過時に round(count/0.5) を返す', () => {
    const { result, rerender } = renderHook(
      ({ active, startTime }) => useCountdownTimer({ active, startTime, onTimeout: vi.fn() }),
      { initialProps: { active: true, startTime: 0 } },
    )

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    // 0.5分で50打 → 100打/分
    expect(result.current.liveSpeed(50)).toBeCloseTo(100, 0)

    rerender({ active: true, startTime: null })
    expect(result.current.liveSpeed(50)).toBe(0)
  })

  // 退行 #153: now（performance.now 刻み）が startTime（最初の打鍵時刻）より小さい
  // 開始直後の瞬間に elapsedSec が負を返さないこと。
  it('開始直後（now < startTime）でも elapsedSec が負にならない', () => {
    // startTime を現在の now(=0) より大きく設定し、interval を数回発火させても now < startTime のままにする
    const { result } = renderHook(() =>
      useCountdownTimer({ active: true, startTime: 5000, onTimeout: vi.fn() }),
    )

    act(() => {
      vi.advanceTimersByTime(200) // 内部 now を ~200 にする（< startTime=5000）
    })

    expect(result.current.elapsedSec).toBeGreaterThanOrEqual(0)
  })
})
