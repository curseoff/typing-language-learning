// @vitest-environment jsdom
// タッチタイピング練習フックの結合テスト（正打鍵で index 進行・60秒で finished・restart 初期化・
// ドリル継ぎ足し・誤キーで mistakes/wrongKey/hasError・Escape で onExit）。
// 出題列は乱数なので毎回 result.current.target を打つ。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTouch } from './useTouch.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
afterEach(() => vi.useRealTimers())

const press = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在の target（正解キー、小文字）を1打。
const typeTarget = (result) => press(result.current.target)

// 最初の打鍵から60秒経過させて時間切れ finish を発火させる。
const runOutClock = () => {
  act(() => {
    vi.advanceTimersByTime(TIME_LIMIT_MS + 200)
  })
  act(() => {
    vi.runOnlyPendingTimers()
  })
}

describe('useTouch（タッチタイピング・結合）', () => {
  it('正しい target キーを打つと index/typedKeys が進む', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    expect(result.current.index).toBe(0)
    typeTarget(result)
    expect(result.current.index).toBe(1)
    expect(result.current.typedKeys).toBe(1)
    typeTarget(result)
    expect(result.current.index).toBe(2)
  })

  it('最初の打鍵から60秒経過で finished=true になる', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    typeTarget(result)
    expect(result.current.finished).toBe(false)
    runOutClock()
    expect(result.current.finished).toBe(true)
  })

  it('restart で index・mistakes・finished が初期化される', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    typeTarget(result)
    press('q') // home に無い誤キー → mistakes++
    typeTarget(result)
    runOutClock()
    expect(result.current.finished).toBe(true)
    expect(result.current.mistakes).toBeGreaterThan(0)
    act(() => {
      result.current.restart()
    })
    expect(result.current.index).toBe(0)
    expect(result.current.mistakes).toBe(0)
    expect(result.current.finished).toBe(false)
  })

  it('ドリルが尽きるまで打つと targets が継ぎ足されて伸びる（40超まで打てる）', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    const initialLen = result.current.targets.length
    // 初期長を超えて正打鍵し続ける（途中で継ぎ足しが起きる）
    for (let i = 0; i < initialLen + 5; i++) typeTarget(result)
    expect(result.current.index).toBe(initialLen + 5)
    expect(result.current.targets.length).toBeGreaterThan(initialLen)
    // index は依然として有効な target を指している
    expect(result.current.target).toBeDefined()
  })

  it('誤キーで mistakes++・wrongKey=押したキー・hasError=true になる', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    // home キー集合に含まれない 'q' を確実な誤キーとして使う（target が 'q' になることはない）
    expect(result.current.target).not.toBe('q')
    press('q')
    expect(result.current.mistakes).toBe(1)
    expect(result.current.wrongKey).toBe('q')
    expect(result.current.hasError).toBe(true)
    // 誤キーでは index は進まない
    expect(result.current.index).toBe(0)
  })

  it('Escape で onExit が呼ばれる', () => {
    const onExit = vi.fn()
    renderHook(() => useTouch({ level: 'home', onExit }))
    press('Escape')
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
