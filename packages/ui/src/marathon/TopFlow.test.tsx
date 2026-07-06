// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import TopFlow from './TopFlow'

afterEach(cleanup)

const segments = [
  { type: 'en', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'ja', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'ja', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'en', en: 'picture', ja: '写真', kana: 'しゃしん', sentenceIndex: 2 },
]

describe('TopFlow smoke', () => {
  it('英語入力/日本語入力/ticker', () => {
    render(<TopFlow segments={segments} segIndex={2} segInput="dic" hasError={false} />)
    render(<TopFlow segments={segments} segIndex={3} segInput="ji" hasError={false} />)
    const { container } = render(
      <TopFlow segments={segments} segIndex={2} segInput="dic" hasError={false} ticker={true} />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
