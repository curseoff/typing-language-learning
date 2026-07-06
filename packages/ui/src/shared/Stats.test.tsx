// @vitest-environment jsdom
// presenter smoke（#233 M7）: 代表 props で描画が落ちず主要文言が出ることを確認する。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Stat, StatsRow } from './Stats'

afterEach(cleanup)

describe('Stat smoke', () => {
  it('label と value を描く', () => {
    const { container } = render(<Stat label="スコア" value="1,240" />)
    expect(container.textContent).toContain('スコア')
    expect(container.textContent).toContain('1,240')
  })
})

describe('StatsRow smoke', () => {
  const stats = [
    { label: '経過', value: '32秒' },
    { label: '入力', value: '128字' },
    { label: 'ミス', value: '3' },
    { label: '速度', value: '4.2 打/秒' },
  ]
  it('進捗途中を描く', () => {
    const { container } = render(<StatsRow stats={stats} progress={0.55} />)
    expect(container.textContent).toContain('経過')
    expect(container.textContent).toContain('速度')
  })
  it('progress=1 でも落ちない', () => {
    const { container } = render(<StatsRow stats={stats} progress={1} />)
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
