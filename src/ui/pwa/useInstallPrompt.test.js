// @vitest-environment jsdom
// useInstallPrompt フックの結合テスト：初期値は false（導線なし）で、beforeinstallprompt 捕捉で
// true になり、appinstalled で false に戻る。unmount で購読が解除される。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt.js'

function makeBIPEvent() {
  const event = new Event('beforeinstallprompt')
  event.preventDefault = vi.fn()
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  return event
}

afterEach(() => {
  cleanup()
  window.dispatchEvent(new Event('appinstalled')) // 導線をリセット
  vi.restoreAllMocks()
})

describe('useInstallPrompt', () => {
  it('初期値は false（導線なし）', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current).toBe(false)
  })

  it('beforeinstallprompt→appinstalled で true/false が切り替わる', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(makeBIPEvent())
    })
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current).toBe(false)
  })

  it('unmount 後は購読が解除され再レンダーされない', () => {
    const { result, unmount } = renderHook(() => useInstallPrompt())
    unmount()
    // unmount 後にイベントを流しても購読解除済みなので値は初期の false のまま。
    act(() => {
      window.dispatchEvent(makeBIPEvent())
    })
    expect(result.current).toBe(false)
  })
})
