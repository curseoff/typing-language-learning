// 物語タブの presenter：物語カード＋モード＋説明＋収録数＋下部タブ＋一覧/記録を描くだけ。
// content（STORIES）・application（loadItemStats/records）・フック（useRecordDetail）には依存せず、
// 選択肢・選択値・コールバック・描画済みノード（browseNode）を props で受ける。
import type { ReactNode } from 'react'
import { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow } from './parts.presenter'
import type { ModeGroup } from './RankSectionView.presenter'

export interface StoryOption {
  id: string
  title: string
  sceneCount: number
  endingCount: number
}

export interface StorySectionViewProps {
  stories: StoryOption[]
  storyId: string
  onStoryIdChange: (id: string) => void
  modeGroups: ModeGroup[]
  mode: string
  onModeChange: (key: string) => void
  focusSection: string
  onFocusSection: (section: string) => void
  modeDesc: ReactNode
  poolCount: ReactNode
  onStart: () => void
  bottomTab: string
  onBottomTabChange: (key: string) => void
  browseNode: ReactNode // container が描いた StoryScenes（一覧）or StoryRecords（記録）
}

export default function StorySectionView({
  stories,
  storyId,
  onStoryIdChange,
  modeGroups,
  mode,
  onModeChange,
  focusSection,
  onFocusSection,
  modeDesc,
  poolCount,
  onStart,
  bottomTab,
  onBottomTabChange,
  browseNode,
}: StorySectionViewProps) {
  return (
    <>
      <SectionLabel>物語</SectionLabel>
      <div className="story-select">
        {stories.map((s) => (
          <button
            key={s.id}
            className={`story-card ${selCls(storyId === s.id, focusSection === 'story')}`}
            onClick={() => {
              onStoryIdChange(s.id)
              onFocusSection('story')
            }}
          >
            <span className="story-card-title">📖 {s.title}</span>
            <span className="story-card-sub">
              {s.sceneCount} 場面 / {s.endingCount} エンド
            </span>
          </button>
        ))}
      </div>

      <SectionLabel>モード</SectionLabel>
      <div className="mode-select">
        {modeGroups.map((g, i) => (
          <div className="mode-group" key={g.course ?? i}>
            {g.course && <div className="mode-course">{g.course}</div>}
            <ModeButtons
              modes={g.modes}
              value={mode}
              focused={focusSection === 'mode'}
              onChange={(k) => {
                onModeChange(k)
                onFocusSection('mode')
              }}
            />
          </div>
        ))}
      </div>
      <p className="mode-desc">{modeDesc}</p>
      <p className="pool-count">{poolCount}</p>

      <StartRow onStart={onStart} />
      <BottomTabs
        value={bottomTab}
        focused={focusSection === 'bottom'}
        onChange={(k) => {
          onBottomTabChange(k)
          onFocusSection('bottom')
        }}
      />
      {browseNode}
    </>
  )
}
