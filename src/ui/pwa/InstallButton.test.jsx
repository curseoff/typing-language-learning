// @vitest-environment jsdom
// InstallButton の結合テスト：canInstall=true（beforeinstallprompt 捕捉後）でのみ表示し、
// クリックで promptInstall が呼ばれ、その後 canInstall が false になり自動的に消える。
// 実際の module 配線（installPrompt.js）を通して合成イベントで駆動する。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import InstallButton from './InstallButton.jsx'

// 合成 beforeinstallprompt イベント（prompt()/userChoice をモック）。
function makeBIPEvent({ outcome = 'accepted' } = {}) {
  const event = new Event('beforeinstallprompt')
  event.preventDefault = vi.fn()
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome })
  return event
}

afterEach(() => {
  cleanup()
  window.dispatchEvent(new Event('appinstalled')) // 導線をリセット
  vi.restoreAllMocks()
})

describe('InstallButton', () => {
  it('インストール導線が無いときは何も表示しない', () => {
    render(<InstallButton />)
    expect(screen.queryByRole('button', { name: 'アプリとして追加' })).toBeNull()
  })

  it('beforeinstallprompt 捕捉後にボタンを表示する', () => {
    render(<InstallButton />)
    act(() => {
      window.dispatchEvent(makeBIPEvent())
    })
    expect(screen.getByRole('button', { name: 'アプリとして追加' })).toBeInTheDocument()
  })

  it('クリックで prompt が呼ばれ、その後ボタンが消える', async () => {
    const event = makeBIPEvent({ outcome: 'accepted' })
    render(<InstallButton />)
    act(() => {
      window.dispatchEvent(event)
    })
    const button = screen.getByRole('button', { name: 'アプリとして追加' })

    await act(async () => {
      fireEvent.click(button)
      await event.userChoice // userChoice の解決を待つ（promptInstall 内で消費される）
    })

    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'アプリとして追加' })).toBeNull()
  })

  it('appinstalled でボタンが消える', () => {
    render(<InstallButton />)
    act(() => {
      window.dispatchEvent(makeBIPEvent())
    })
    expect(screen.getByRole('button', { name: 'アプリとして追加' })).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: 'アプリとして追加' })).toBeNull()
  })
})
