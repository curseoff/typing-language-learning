// @vitest-environment jsdom
// presenter smoke（#233 M7）: 記録あり/空の双方。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import RecordsTable from './RecordsTable'

afterEach(cleanup)

const recs = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, endLabel: '60秒', date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, endLabel: '60秒', date: '2026-07-04 10:00' },
]

describe('RecordsTable smoke', () => {
  it('ランキングを描く', () => {
    const { container } = render(
      <RecordsTable records={recs} modeKey="both" rankText="英語・日本語" endCondition={{ kind: 'time', value: 60 }} />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
  it('空でも落ちない', () => {
    const { container } = render(
      <RecordsTable records={[]} modeKey="both" rankText="英語・日本語" endCondition={{ kind: 'time', value: 60 }} />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
