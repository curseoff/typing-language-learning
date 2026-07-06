// @vitest-environment jsdom
// presenter smoke（#233 M7）: Text.tsx の各表示部品が代表 props で描画できることを確認する。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import {
  Chars,
  RubyChars,
  RubyTyped,
  RubyText,
  MaskedRubyText,
  Typed,
  MaskedText,
  Chips,
} from './Text'

afterEach(cleanup)

describe('Text presenters smoke', () => {
  it('Chars: 入力中/ミス/完了', () => {
    render(<Chars text="dictionary" done={4} cursor={4} hasError={false} />)
    render(<Chars text="dictionary" done={4} cursor={4} hasError={true} />)
    const { container } = render(<Chars text="travel" done={6} cursor={-1} hasError={false} />)
    expect(container.textContent).toContain('t')
  })

  it('RubyChars: 漢字とふりがなを描く', () => {
    const { container } = render(
      <RubyChars ja="辞書" kana="じしょ" done={0} cursor={0} kanaDone={2} hasError={false} />,
    )
    expect(container.textContent).toContain('辞')
  })

  it('RubyTyped: 入力中/ミス', () => {
    render(<RubyTyped ja="辞書" kana="じしょ" done={0} kanaDone={2} hasError={false} />)
    const { container } = render(
      <RubyTyped ja="辞書" kana="じしょ" done={0} kanaDone={1} hasError={true} />,
    )
    expect(container.textContent).toContain('辞')
  })

  it('RubyText: 単語と例文', () => {
    const { container } = render(<RubyText ja="辞書" kana="じしょ" />)
    expect(container.querySelector('ruby')).toBeTruthy()
    render(<RubyText ja="今日は良い天気です" kana="きょうはよいてんきです" />)
  })

  it('MaskedRubyText: マスク描画', () => {
    const { container } = render(<MaskedRubyText ja="辞書" kana="じしょ" />)
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })

  it('Typed: 進捗/ミス', () => {
    render(<Typed text="dictionary" done={4} hasError={false} />)
    const { container } = render(<Typed text="dictionary" done={4} hasError={true} />)
    expect(container.textContent).toContain('dictionary')
  })

  it('MaskedText: マスク/ミス', () => {
    render(<MaskedText text="dictionary" pos={4} hasError={false} />)
    const { container } = render(<MaskedText text="dictionary" pos={4} hasError={true} />)
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })

  it('Chips: 語チップ列', () => {
    const chips = [
      { text: 'I', i: 0 },
      { text: 'like', i: 1 },
      { text: 'this', i: 2 },
      { text: 'book', i: 3 },
    ]
    const { container } = render(
      <Chips chips={chips} used={2} curDone={2} curKanaDone={0} hasError={false} />,
    )
    expect(container.textContent).toContain('like')
  })
})
