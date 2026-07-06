// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import OptionJa from './OptionJa'

afterEach(cleanup)

describe('OptionJa smoke', () => {
  it('revealed でルビ表示', () => {
    const { container } = render(<OptionJa ja="辞書" kana="じしょ" revealed={true} />)
    expect(container.textContent).toContain('辞')
  })
  it('masked と英語側でも落ちない', () => {
    render(<OptionJa ja="辞書" kana="じしょ" revealed={false} />)
    const { container } = render(<OptionJa ja="dictionary" revealed={true} />)
    expect(container.textContent).toContain('dictionary')
  })
})
