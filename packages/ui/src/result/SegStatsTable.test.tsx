// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import SegStatsTable from './SegStatsTable'

afterEach(cleanup)

describe('SegStatsTable smoke', () => {
  it('設問ごとの正誤を表に描く', () => {
    const quiz = [
      { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
      { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
      { no: 3, label: 'travel', answer: '旅行', correct: true, mistakes: 1 },
    ]
    const { container } = render(<SegStatsTable segStats={quiz} />)
    expect(container.textContent).toContain('dictionary')
    expect(container.textContent).toContain('旅行')
  })
})
