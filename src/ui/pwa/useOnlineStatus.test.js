// @vitest-environment jsdom
// useOnlineStatus フックの結合テスト：初期値は navigator.onLine に従い、
// online/offline イベントで状態が切り替わる。unmount でリスナが解除される。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus.js'

function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  cleanup()
  setOnLine(true)
  vi.restoreAllMocks()
})

describe('useOnlineStatus', () => {
  it('初期値は navigator.onLine に従う', () => {
    setOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('online→offline イベントで状態が切り替わる', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('unmount でイベントリスナが解除される', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useOnlineStatus())
    unmount()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
