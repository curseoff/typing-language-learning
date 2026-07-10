// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Passage from './Passage.presenter'

afterEach(cleanup)

const segments = [
  { type: 'en', canonical: 'good morning', variants: ['good morning'] },
  { type: 'ja', ja: 'おはよう', kana: 'おはよう', canonical: 'ohayou', variants: ['ohayou'] },
  { type: 'en', canonical: 'dictionary', variants: ['dictionary'] },
  { type: 'ja', ja: '辞書', kana: 'じしょ', canonical: 'jisho', variants: ['jisho', 'zisyo'] },
  { type: 'en', canonical: 'picture', variants: ['picture'] },
]

describe('Passage smoke', () => {
  it('入力中', () => {
    const { container } = render(
      <Passage segments={segments} segIndex={2} segInput="dic" completed={{}} hasError={false} />,
    )
    expect(container.textContent).toContain('dictionary')
  })
  it('ミスでも落ちない', () => {
    const { container } = render(
      <Passage segments={segments} segIndex={2} segInput="dix" completed={{}} hasError={true} />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
