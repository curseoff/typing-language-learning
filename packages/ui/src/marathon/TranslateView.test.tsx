// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import TranslateView from './TranslateView'

afterEach(cleanup)

const segments = [
  {
    type: 'en',
    en: 'good morning',
    ja: 'おはよう',
    kana: 'おはよう',
    canonical: 'good morning',
    variants: ['good morning'],
    words: ['good', 'morning'],
    chips: [
      { text: 'morning', i: 1 },
      { text: 'good', i: 0 },
    ],
  },
  {
    type: 'en',
    en: 'thank you',
    ja: 'ありがとう',
    kana: 'ありがとう',
    canonical: 'thank you',
    variants: ['thank you'],
    words: ['thank', 'you'],
    chips: [
      { text: 'you', i: 1 },
      { text: 'thank', i: 0 },
    ],
  },
]

describe('TranslateView smoke', () => {
  it('和文→英語（未入力/入力中）', () => {
    render(<TranslateView segments={segments} segIndex={0} segInput="" hasError={false} />)
    const { container } = render(
      <TranslateView segments={segments} segIndex={0} segInput="good " hasError={false} />,
    )
    expect(container.textContent).toContain('おはよう')
  })
})
