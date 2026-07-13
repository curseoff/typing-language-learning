// @vitest-environment jsdom
// #364 単語例文の固定範囲セレクタ（共有 RangeStepper・単位「文」）の UI テスト。範囲別ラベルと
// 位置表示の配線を固定する。ステッパーの端挙動は WordsSection.test が共有部品として担保。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within, waitFor } from '@testing-library/react'
import WordSentenceSection from './WordSentenceSection.container.jsx'
import { initMemoryPersistence } from '../../application/records.service.js'

const noop = () => {}
const baseProps = {
  mode: 'both',
  onModeChange: noop,
  wsentLevel: 1,
  wsentTheme: '日常', // WSENT_COUNTS[1]['日常'] = 220 → 範囲数 3
  onWsentLevelChange: noop,
  onWsentThemeChange: noop,
  wsentRange: null,
  onWsentRangeChange: noop,
  focusSection: 'level',
  onFocusSection: noop,
  bottomTab: 'records',
  onBottomTabChange: noop,
  onStart: noop,
  records: {},
  endCondition: { kind: 'time', value: 60 },
  onEndConditionChange: noop,
}

const stepper = (container) => container.querySelector('.range-stepper')

describe('WordSentenceSection 範囲ステッパー (#364)', () => {
  beforeEach(() => {
    cleanup()
    initMemoryPersistence()
  })
  afterEach(cleanup)

  it('既定は「範囲指定なし（全体）」で位置は — / 3（220文→3範囲）', () => {
    const { container } = render(<WordSentenceSection {...baseProps} />)
    const s = stepper(container)
    expect(within(s).getByText(/範囲指定なし/)).toBeTruthy()
    expect(within(s).getByText('— / 3')).toBeTruthy()
  })

  it('▶ で範囲1へ（onWsentRangeChange(1)）', () => {
    let picked = 'unset'
    const { container } = render(
      <WordSentenceSection {...baseProps} onWsentRangeChange={(r) => (picked = r)} />,
    )
    fireEvent.click(within(stepper(container)).getByLabelText('次の範囲'))
    expect(picked).toBe(1)
  })

  it('範囲選択中はラベルを「文」単位で表示し末尾は実長に丸める', () => {
    const { container } = render(<WordSentenceSection {...baseProps} wsentRange={3} />)
    const s = stepper(container)
    expect(within(s).getByText('201-220 文')).toBeTruthy() // 末尾は実長に丸め・単位は文
    expect(within(s).getByText('3 / 3')).toBeTruthy()
  })

  it('収録一覧タブ＋範囲指定で該当範囲の例文を読み込んで表示する（freq 結合）', async () => {
    const { container } = render(<WordSentenceSection {...baseProps} bottomTab="list" wsentRange={1} />)
    // range 時は例文＋単語(freqMap)を遅延ロード＝はじめは「読み込み中…」。
    expect(within(container).getByText('読み込み中…')).toBeTruthy()
    await waitFor(() => expect(within(container).queryByText('読み込み中…')).toBeNull(), { timeout: 5000 })
  })
})
