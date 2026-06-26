// @vitest-environment jsdom
// 記録詳細の表示テスト。物語の新記録は「選んだ選択肢」を順番に描画し、
// 旧記録（choices 無し）には出さない（後方互換）。
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RecordDetail from './RecordDetail.jsx'

afterEach(cleanup)

const base = {
  source: 'story',
  mode: 'en',
  ending: 'good',
  endLabel: 'グッドエンド',
  speed: 200,
  keys: 100,
  mistakes: 1,
  accuracy: 99,
  seconds: 30,
  date: '2026/06/26',
}

const renderDetail = (record) =>
  render(
    <RecordDetail
      list={[record]}
      initial={{ record, position: 1 }}
      rankText="物語"
      modeKey="en"
      isQuiz={false}
      hasEnding
      onClose={() => {}}
    />,
  )

describe('RecordDetail：選んだ選択肢', () => {
  it('choices があれば順番に ja/en を描画する', () => {
    renderDetail({
      ...base,
      choices: [
        { en: 'I am here for sightseeing.', ja: '観光で来ました。' },
        { en: 'Yes, please.', ja: 'はい、お願いします。' },
      ],
    })
    expect(screen.getByText('選んだ選択肢')).toBeInTheDocument()
    const items = document.querySelectorAll('.choice-list li')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toContain('観光で来ました。')
    expect(items[0].textContent).toContain('I am here for sightseeing.')
    expect(items[1].textContent).toContain('はい、お願いします。')
  })

  it('choices が無い旧記録には「選んだ選択肢」を出さない', () => {
    renderDetail({ ...base })
    expect(screen.queryByText('選んだ選択肢')).toBeNull()
  })

  it('choices が空配列なら出さない', () => {
    renderDetail({ ...base, choices: [] })
    expect(screen.queryByText('選んだ選択肢')).toBeNull()
  })
})
