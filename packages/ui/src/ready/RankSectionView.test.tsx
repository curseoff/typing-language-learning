// @vitest-environment jsdom
// presenter smoke（#233 M7）: 一覧タブ/記録タブ。ノード props はダミー要素で与える。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import RankSectionView from './RankSectionView'

afterEach(cleanup)

const noop = () => {}
const levels = [
  { value: 1, no: 'L1', label: 'やさしい' },
  { value: 2, no: 'L2', label: 'ふつう' },
  { value: 3, no: 'L3', label: 'むずかしい' },
]
const themes = ['すべて', '日常', '旅行', 'ビジネス']
const modeGroups = [
  { course: '通常入力', modes: [{ key: 'both', label: '英語・日本語' }, { key: 'en', label: '英語' }, { key: 'ja', label: '日本語' }] },
  { course: '4択', modes: [{ key: 'quiz-ja', label: '日本語' }, { key: 'quiz-en', label: '英語' }] },
]
const shared = {
  levels,
  themes,
  modeGroups,
  level: 1,
  theme: 'すべて',
  mode: 'both',
  onLevelChange: noop,
  onThemeChange: noop,
  onModeChange: noop,
  onFocusSection: noop,
  modeDesc: '英語と日本語を交互に入力します。',
  poolCount: '収録 320 語',
  onStart: noop,
  onBottomTabChange: noop,
  endConditionNode: <div data-testid="end-node">end</div>,
}

describe('RankSectionView smoke', () => {
  it('一覧タブ', () => {
    const { container } = render(
      <RankSectionView {...shared} focusSection="mode" bottomTab="list" browseNode={<div>browse</div>} />,
    )
    expect(container.textContent).toContain('やさしい')
  })
  it('記録タブ', () => {
    const { container } = render(
      <RankSectionView {...shared} focusSection="level" bottomTab="records" browseNode={<div>records</div>} />,
    )
    expect(container.textContent).toContain('収録 320 語')
  })
})
