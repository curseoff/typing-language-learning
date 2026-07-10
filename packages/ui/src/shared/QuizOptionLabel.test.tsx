// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import QuizOptionLabel from './QuizOptionLabel.presenter'

afterEach(cleanup)

const jaOpt = { display: '辞書', variants: ['じしょ'], kana: 'じしょ' }
const enOpt = { display: 'dictionary', variants: ['dictionary'] }

describe('QuizOptionLabel smoke', () => {
  it('日本語選択肢（未入力/入力中）', () => {
    render(<QuizOptionLabel opt={jaOpt} input="" picked={null} hasError={false} />)
    const { container } = render(
      <QuizOptionLabel opt={jaOpt} input="じ" picked={null} hasError={false} />,
    )
    expect(container.textContent).toContain('辞')
  })
  it('英語選択肢（未入力/入力中）', () => {
    render(<QuizOptionLabel opt={enOpt} input="" picked={null} hasError={false} />)
    const { container } = render(
      <QuizOptionLabel opt={enOpt} input="dict" picked={null} hasError={false} />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})
