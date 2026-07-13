// @vitest-environment jsdom
// #364 英英の固定範囲セレクタ（共有 RangeStepper）の UI テスト。範囲別ラベル・記録表示（rankText の
// 範囲サフィックス）の配線を固定する。ステッパーの端挙動は WordsSection.test が共有部品として担保。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within, waitFor } from '@testing-library/react'
import DictSection from './DictSection.container.jsx'
import { initMemoryPersistence } from '../../application/records.service.js'

const noop = () => {}
const baseProps = {
  dictLevel: 1,
  dictTheme: '日常', // DICT_COUNTS[1]['日常'] = 639 → 範囲数 7
  dictMode: 'quiz',
  dictRange: null,
  onDictLevelChange: noop,
  onDictThemeChange: noop,
  onDictModeChange: noop,
  onDictRangeChange: noop,
  focusSection: 'level',
  onFocusSection: noop,
  bottomTab: 'records',
  onBottomTabChange: noop,
  onStart: noop,
  endCondition: { kind: 'time', value: 60 },
  onEndConditionChange: noop,
}

const stepper = (container) => container.querySelector('.range-stepper')

describe('DictSection 範囲ステッパー (#364)', () => {
  beforeEach(() => {
    cleanup()
    initMemoryPersistence()
  })
  afterEach(cleanup)

  it('既定は「範囲指定なし（全体）」で位置は — / 7（639語→7範囲）', () => {
    const { container } = render(<DictSection {...baseProps} />)
    const s = stepper(container)
    expect(within(s).getByText(/範囲指定なし/)).toBeTruthy()
    expect(within(s).getByText('— / 7')).toBeTruthy()
  })

  it('▶ で範囲1へ（onDictRangeChange(1)）', () => {
    let picked = 'unset'
    const { container } = render(
      <DictSection {...baseProps} onDictRangeChange={(r) => (picked = r)} />,
    )
    fireEvent.click(within(stepper(container)).getByLabelText('次の範囲'))
    expect(picked).toBe(1)
  })

  it('範囲選択中はラベルを「語」単位で表示し位置も範囲別になる', () => {
    const { container } = render(<DictSection {...baseProps} dictRange={1} />)
    const s = stepper(container)
    expect(within(s).getByText('1-100 語')).toBeTruthy()
    expect(within(s).getByText('1 / 7')).toBeTruthy()
  })

  it('収録一覧タブ＋範囲指定で該当範囲の英英を読み込んで表示する（freq 結合）', async () => {
    const { container } = render(<DictSection {...baseProps} bottomTab="list" dictRange={1} />)
    // range 時は英英＋単語(freqMap)を遅延ロード＝はじめは「読み込み中…」。
    expect(within(container).getByText('読み込み中…')).toBeTruthy()
    await waitFor(() => expect(within(container).queryByText('読み込み中…')).toBeNull(), { timeout: 5000 })
  })
})
