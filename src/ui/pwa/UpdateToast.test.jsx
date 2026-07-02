// @vitest-environment jsdom
// PWA 更新トーストの表示ロジックを結合テスト：更新検知でトーストが出て、
// 「更新」で適用関数が呼ばれ閉じ、「後で」で閉じる（適用は呼ばれない）。
// SW 配線（registerServiceWorker）はモックして onUpdate コールバックを捕捉する。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

// vi.mock のファクトリはホイストされるため、捕捉先は vi.hoisted で用意する。
const h = vi.hoisted(() => ({ onUpdate: undefined }))
vi.mock('../../infrastructure/pwa/registerSW.js', () => ({
  registerServiceWorker: ({ onUpdate }) => {
    h.onUpdate = onUpdate
  },
}))

import UpdateToast from './UpdateToast.jsx'

describe('UpdateToast', () => {
  beforeEach(() => {
    cleanup()
    h.onUpdate = undefined
  })

  it('更新未検知のときは何も表示しない', () => {
    render(<UpdateToast />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('更新検知でトーストが出て、「更新」で適用関数が呼ばれ閉じる', () => {
    render(<UpdateToast />)
    const apply = vi.fn()
    act(() => h.onUpdate(apply)) // 更新検知を発火
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('新しいバージョンがあります')).toBeInTheDocument()

    fireEvent.click(screen.getByText('更新'))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull() // 押下後は隠れる
  })

  it('「後で」で閉じ、適用関数は呼ばれない', () => {
    render(<UpdateToast />)
    const apply = vi.fn()
    act(() => h.onUpdate(apply))
    fireEvent.click(screen.getByText('後で'))
    expect(apply).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
