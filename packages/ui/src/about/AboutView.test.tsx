// @vitest-environment jsdom
// presenter smoke: 主要見出し・CTA の存在・onStart 発火。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import AboutView from './AboutView'

afterEach(cleanup)

describe('AboutView smoke', () => {
  it('主要見出しとリードを描く', () => {
    const { container } = render(<AboutView onStart={() => {}} />)
    expect(container.textContent).toContain('打って、覚える。')
    expect(container.textContent).toContain('英語学習タイピング')
    expect(container.textContent).toContain('なぜ「打つ」のか')
    expect(container.textContent).toContain('5つの学習')
    expect(container.textContent).toContain('打てば、変わる。')
  })

  it('見出し階層（h2/h3）を正しく使う', () => {
    const { container } = render(<AboutView onStart={() => {}} />)
    expect(container.querySelector('h2')?.textContent).toContain('打って、覚える。')
    expect(container.querySelectorAll('h3').length).toBeGreaterThanOrEqual(4)
  })

  it('「はじめる」で onStart が発火する', () => {
    const onStart = vi.fn()
    const { getAllByRole } = render(<AboutView onStart={onStart} />)
    const start = getAllByRole('button', { name: 'はじめる' })
    expect(start.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(start[0])
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('「戻る」で onStart が発火する', () => {
    const onStart = vi.fn()
    const { getByRole } = render(<AboutView onStart={onStart} />)
    fireEvent.click(getByRole('button', { name: '← 戻る' }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
