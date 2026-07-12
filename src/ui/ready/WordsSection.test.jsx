// @vitest-environment jsdom
// #362 単語の固定範囲セレクタ（数値ステッパー）の UI テスト。範囲数が最大152でも1操作で収まる
// ◀ ラベル(n/総数) ▶ の挙動（既定=範囲指定なし・端で止まる・変更コールバック）を固定する。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within } from '@testing-library/react'
import WordsSection from './WordsSection.container.jsx'
import { initMemoryPersistence } from '../../application/records.service.js'

const noop = () => {}
const baseProps = {
  wordLevel: 1,
  wordTheme: '日常', // WORD_COUNTS[1]['日常'] = 220 → 範囲数 3（1-100 / 101-200 / 201-220）
  wordMode: 'en',
  wordRange: null,
  onWordLevelChange: noop,
  onThemeChange: noop,
  onWordModeChange: noop,
  onWordRangeChange: noop,
  focusSection: 'level',
  onFocusSection: noop,
  bottomTab: 'records',
  onBottomTabChange: noop,
  onStart: noop,
  endCondition: { kind: 'time', value: 60 },
  onEndConditionChange: noop,
}

const stepper = (container) => container.querySelector('.range-stepper')

describe('WordsSection 範囲ステッパー (#362)', () => {
  beforeEach(() => {
    cleanup()
    initMemoryPersistence()
  })
  afterEach(cleanup)

  it('既定は「範囲指定なし（全体）」で ◀ は無効・▶ は有効', () => {
    const { container } = render(<WordsSection {...baseProps} />)
    const s = stepper(container)
    expect(within(s).getByText(/範囲指定なし/)).toBeTruthy()
    expect(within(s).getByText('— / 3')).toBeTruthy() // 220語→3範囲
    const [prev, next] = within(s).getAllByRole('button')
    expect(prev.disabled).toBe(true) // 範囲指定なしより左は無い
    expect(next.disabled).toBe(false)
  })

  it('▶ で範囲1へ（onWordRangeChange(1)）', () => {
    let picked = 'unset'
    const { container } = render(
      <WordsSection {...baseProps} onWordRangeChange={(r) => (picked = r)} />,
    )
    const next = within(stepper(container)).getByLabelText('次の範囲')
    fireEvent.click(next)
    expect(picked).toBe(1)
  })

  it('範囲選択中は末尾ラベル（201-220 語）と位置（3/3）を実長で表示し ▶ が止まる', () => {
    let picked = 'unset'
    const { container } = render(
      <WordsSection {...baseProps} wordRange={3} onWordRangeChange={(r) => (picked = r)} />,
    )
    const s = stepper(container)
    expect(within(s).getByText('201-220 語')).toBeTruthy() // 末尾は実長に丸め
    expect(within(s).getByText('3 / 3')).toBeTruthy()
    const next = within(s).getByLabelText('次の範囲')
    expect(next.disabled).toBe(true) // 末尾で止まる
    // ◀ は範囲2へ戻す
    fireEvent.click(within(s).getByLabelText('前の範囲'))
    expect(picked).toBe(2)
  })

  it('範囲1で ◀ を押すと「範囲指定なし」(null) へ戻る', () => {
    let picked = 'unset'
    const { container } = render(
      <WordsSection {...baseProps} wordRange={1} onWordRangeChange={(r) => (picked = r)} />,
    )
    fireEvent.click(within(stepper(container)).getByLabelText('前の範囲'))
    expect(picked).toBe(null)
  })
})
