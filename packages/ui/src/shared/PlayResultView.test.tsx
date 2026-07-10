// @vitest-environment jsdom
// presenter smoke（#233 M7）: 入力系と4択系の結果を描く。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import PlayResultView from './PlayResultView.presenter'

afterEach(cleanup)

const noop = () => {}
const list = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, date: '2026-07-04 10:00' },
]
const segStats = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
]
const handlers = { onRetry: noop, onExit: noop, onRowClick: noop }

describe('PlayResultView smoke', () => {
  it('タイム制の入力結果', () => {
    const { container } = render(
      <PlayResultView
        isQuiz={false}
        result={{
          endCondition: { kind: 'time', value: 60 },
          keys: 240,
          speed: 240,
          mistakes: 5,
          accuracy: 98,
          seconds: 60,
          date: '2026-07-05 21:00',
          segStats,
        }}
        list={list}
        {...handlers}
      />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
  it('問題数制の4択結果', () => {
    const { container } = render(
      <PlayResultView
        isQuiz={true}
        result={{
          endCondition: { kind: 'items', value: 25 },
          correctCount: 23,
          accuracy: 96,
          seconds: 72,
          correct: 23,
          words: 25,
          mistakes: 3,
          date: '2026-07-05 21:00',
          segStats,
        }}
        list={list}
        {...handlers}
      />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})
