// @vitest-environment jsdom
// #286 メニューバー presenter の smoke/挙動テスト（開閉トグル・disabled 非発火）。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MenuBarView from './MenuBarView'
import type { MenuBarMenu } from './MenuBarView'

afterEach(cleanup)

const menus: MenuBarMenu[] = [
  {
    id: 'app',
    label: 'アプリ',
    items: [{ id: 'about', label: 'このアプリについて', enabled: true }],
  },
  {
    id: 'data',
    label: 'データ',
    items: [
      { id: 'export', label: 'エクスポート', icon: '💾', enabled: true },
      { id: 'import', label: '復元', enabled: false, reason: 'SQLite 保存が有効なタブでのみ使えます' },
    ],
  },
]

const noop = () => {}

describe('MenuBarView', () => {
  it('トリガのクリックで onToggle(id) を呼ぶ（aria-expanded は openId 由来）', () => {
    const onToggle = vi.fn()
    render(
      <MenuBarView appName="アプリ" menus={menus} openId={null} onToggle={onToggle} onSelect={noop} onClose={noop} />,
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'データ' }))
    expect(onToggle).toHaveBeenCalledWith('data')
    // 閉じているのでドロップダウンは無い
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('openId のメニューだけドロップダウンを開く', () => {
    render(
      <MenuBarView appName="アプリ" menus={menus} openId="data" onToggle={noop} onSelect={noop} onClose={noop} />,
    )
    const trigger = screen.getByRole('menuitem', { name: 'データ' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu', { name: 'データ' })).toBeTruthy()
  })

  it('enabled 項目は onSelect(itemId) を呼び、disabled 項目は発火しない', () => {
    const onSelect = vi.fn()
    render(
      <MenuBarView appName="アプリ" menus={menus} openId="data" onToggle={noop} onSelect={onSelect} onClose={noop} />,
    )
    fireEvent.click(screen.getByRole('menuitem', { name: /エクスポート/ }))
    expect(onSelect).toHaveBeenCalledWith('export')

    const disabled = screen.getByRole('menuitem', { name: /復元/ }) as HTMLButtonElement
    expect(disabled.disabled).toBe(true)
    expect(disabled.getAttribute('title')).toBe('SQLite 保存が有効なタブでのみ使えます')
    fireEvent.click(disabled)
    expect(onSelect).toHaveBeenCalledTimes(1) // disabled は増えない
  })

  it('開いている間の外側クリックで onClose を呼ぶ', () => {
    const onClose = vi.fn()
    render(
      <MenuBarView appName="アプリ" menus={menus} openId="data" onToggle={noop} onSelect={noop} onClose={onClose} />,
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalled()
  })
})
