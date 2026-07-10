// @vitest-environment jsdom
// presenter smoke（#233 M7）: 物語タブの一覧/記録。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import StorySectionView from './StorySectionView.presenter'

afterEach(cleanup)

const noop = () => {}
const stories = [
  { id: 'travel', title: '旅の物語', sceneCount: 12, endingCount: 5 },
  { id: 'mystery', title: '館の謎', sceneCount: 9, endingCount: 4 },
]
const modeGroups = [
  { course: '通常入力', modes: [{ key: 'both', label: '英語・日本語' }, { key: 'en', label: '英語' }, { key: 'ja', label: '日本語' }] },
]
const shared = {
  stories,
  modeGroups,
  storyId: 'travel',
  mode: 'both',
  onStoryIdChange: noop,
  onModeChange: noop,
  onFocusSection: noop,
  onStart: noop,
  onBottomTabChange: noop,
  modeDesc: '物語を読み進めながら英語と日本語を入力します。',
  poolCount: '12 場面 / 5 エンド',
}

describe('StorySectionView smoke', () => {
  it('一覧タブ', () => {
    const { container } = render(
      <StorySectionView {...shared} focusSection="story" bottomTab="list" browseNode={<div>browse</div>} />,
    )
    expect(container.textContent).toContain('旅の物語')
  })
  it('記録タブ', () => {
    const { container } = render(
      <StorySectionView {...shared} focusSection="mode" bottomTab="records" browseNode={<div>records</div>} />,
    )
    expect(container.textContent).toContain('12 場面 / 5 エンド')
  })
})
