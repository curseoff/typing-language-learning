// @vitest-environment jsdom
// OfflineBanner の結合テスト：オフライン時のみ表示し role="status" を持つ。
// オンライン時は何も描画しない。offline→online の遷移で自動的に消える。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import OfflineBanner from './OfflineBanner.container.jsx'

function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  cleanup()
  setOnLine(true)
  vi.restoreAllMocks()
})

describe('OfflineBanner', () => {
  it('オンライン時は何も表示しない', () => {
    setOnLine(true)
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('オフライン時にバナーを表示し role="status" を持つ', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('オフライン：学習は続けられます')
  })

  it('オンライン復帰で自動的に消える', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
