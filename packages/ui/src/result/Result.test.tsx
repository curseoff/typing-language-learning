// @vitest-environment jsdom
// presenter smoke（#233 M7）: 入力結果と4択結果。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Result from './Result'

afterEach(cleanup)

const noop = () => {}
const recs = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, date: '2026-07-04 10:00' },
]
const quiz = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
]
const base = {
  mode: 'both',
  rank: 1,
  theme: 'すべて',
  source: 'wsent',
  keys: 240,
  speed: 240,
  mistakes: 5,
  accuracy: 98,
  correctCount: 20,
  seconds: 60,
  date: '2026-07-05 21:00',
}

describe('Result smoke', () => {
  it('サマリ（入力）', () => {
    const { container } = render(
      <Result
        result={{ ...base, endCondition: { kind: 'time', value: 60 } }}
        modeText="英語・日本語"
        segStats={[]}
        records={recs}
        onRetry={noop}
      />,
    )
    expect(container.textContent).toContain('英語・日本語')
  })
  it('4択（問題数）', () => {
    const { container } = render(
      <Result
        result={{ ...base, mode: 'quiz-ja', correctCount: 23, endCondition: { kind: 'items', value: 25 } }}
        modeText="日本語（4択）"
        segStats={quiz}
        records={recs}
        onRetry={noop}
      />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})
