// @vitest-environment jsdom
// ローマ字入力練習フックの結合テスト（正しいローマ字で index/keys 進行・多字かなは途中確定しない・
// 誤字で mistakes/wrongKey/hasError・60秒で finished・restart 初期化・Escape で onExit）。
// 出題列は乱数なので毎回 result.current.current の canonical ローマ字を打つ。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { toRomaji } from '@tll/core'
import { useRomaji } from './useRomaji.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
afterEach(() => vi.useRealTimers())

const press = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在かなを canonical ローマ字で1文字ずつ打ち切る。
const typeKana = (result) => {
  for (const ch of toRomaji(result.current.current)) press(ch)
}

const runOutClock = () => {
  act(() => {
    vi.advanceTimersByTime(TIME_LIMIT_MS + 200)
  })
  act(() => {
    vi.runOnlyPendingTimers()
  })
}

describe('useRomaji（ローマ字入力練習・結合）', () => {
  it('正しいローマ字を打つと index/keys が進む（あ行＝1打1かな）', () => {
    const { result } = renderHook(() => useRomaji({ level: 'a', onExit: vi.fn() }))
    expect(result.current.index).toBe(0)
    typeKana(result)
    expect(result.current.index).toBe(1)
    expect(result.current.keys).toBe(1)
    typeKana(result)
    expect(result.current.index).toBe(2)
  })

  it('多字かな（拗音）は途中入力では確定せずバッファに溜まり、綴り切ると進む', () => {
    const { result } = renderHook(() => useRomaji({ level: 'youon', onExit: vi.fn() }))
    const r = toRomaji(result.current.current) // 例: kya
    expect(r.length).toBeGreaterThan(1)
    press(r[0])
    expect(result.current.index).toBe(0)
    expect(result.current.input).toBe(r[0])
    for (const ch of r.slice(1)) press(ch)
    expect(result.current.index).toBe(1)
    expect(result.current.input).toBe('')
  })

  it('受理外キーで mistakes++・wrongKey・hasError になり index は進まない', () => {
    const { result } = renderHook(() => useRomaji({ level: 'a', onExit: vi.fn() }))
    // あ行の綴りはすべて母音 1 字。子音 'z' は受理外＝確実な誤字。
    press('z')
    expect(result.current.mistakes).toBe(1)
    expect(result.current.wrongKey).toBe('z')
    expect(result.current.hasError).toBe(true)
    expect(result.current.index).toBe(0)
    expect(result.current.input).toBe('')
  })

  it('最初の打鍵から60秒経過で finished=true になる', () => {
    const { result } = renderHook(() => useRomaji({ level: 'a', onExit: vi.fn() }))
    typeKana(result)
    expect(result.current.finished).toBe(false)
    runOutClock()
    expect(result.current.finished).toBe(true)
  })

  it('restart で index・mistakes・finished が初期化される', () => {
    const { result } = renderHook(() => useRomaji({ level: 'a', onExit: vi.fn() }))
    typeKana(result)
    press('z') // 誤字 → mistakes++
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

  it('ドリルが尽きるまで打つと targets が継ぎ足されて伸びる', () => {
    const { result } = renderHook(() => useRomaji({ level: 'a', onExit: vi.fn() }))
    const initialLen = result.current.targets.length
    for (let i = 0; i < initialLen + 3; i++) typeKana(result)
    expect(result.current.index).toBe(initialLen + 3)
    expect(result.current.targets.length).toBeGreaterThan(initialLen)
    expect(result.current.current).toBeDefined()
  })

  it('finished 後に Enter で restart される', () => {
    const { result } = renderHook(() => useRomaji({ level: 'a', onExit: vi.fn() }))
    typeKana(result)
    runOutClock()
    expect(result.current.finished).toBe(true)
    press('Enter')
    expect(result.current.finished).toBe(false)
    expect(result.current.index).toBe(0)
  })

  it('未知のレベルは先頭レベルへフォールバックして出題される', () => {
    const { result } = renderHook(() => useRomaji({ level: 'no-such', onExit: vi.fn() }))
    expect(result.current.current).toBeDefined()
    expect(result.current.total).toBeGreaterThan(0)
    typeKana(result)
    expect(result.current.index).toBe(1)
  })

  it('Escape で onExit が呼ばれる', () => {
    const onExit = vi.fn()
    renderHook(() => useRomaji({ level: 'a', onExit }))
    press('Escape')
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
