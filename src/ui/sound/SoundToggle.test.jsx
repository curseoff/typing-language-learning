// @vitest-environment jsdom
// 効果音トグルの結合テスト：既定オン（aria-pressed=false）／クリックでミュート切替＋永続、
// aria-label が状態に追従する。設定は soundSettingsRepository（localStorage）に保存される。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import SoundToggle from './SoundToggle.jsx'
import { isSoundMuted } from '../../infrastructure/soundSettingsRepository.js'

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

describe('SoundToggle', () => {
  it('既定はオン（aria-pressed=false・オフにするラベル）', () => {
    render(<SoundToggle />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', '効果音をオフにする')
  })

  it('クリックでミュートに切り替わり永続する', () => {
    render(<SoundToggle />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', '効果音をオンにする')
    expect(isSoundMuted()).toBe(true)
  })

  it('もう一度クリックでオンに戻る', () => {
    render(<SoundToggle />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(isSoundMuted()).toBe(false)
  })
})
