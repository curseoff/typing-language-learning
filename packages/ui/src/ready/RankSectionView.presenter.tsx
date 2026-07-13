// スタート画面の「レベル×テーマ×モード」型セクションの共有 presenter。
// 単語 / 英英 / 単語例文の3タブは同じ骨格（レベル→テーマ→モード→説明→収録数→終了条件→スタート→
// 下部タブ→一覧/記録）なので1つの View に集約する。content/records/フックには依存せず、選択肢・選択値・
// コールバック・描画済みノード（endConditionNode / browseNode）を props で受けて描くだけ。
import type { ReactNode } from 'react'
import { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow, type Mode } from './parts.presenter'

export interface RankLevel {
  value: number
  no: string // ランク記号（例 'W1' / 'L2'）
  label: string
}

export interface ModeGroup {
  course?: string // 見出し（'通常入力' / '4択' / MODES の group 名）
  modes: Mode[]
}

export interface RankSectionViewProps {
  levels: RankLevel[]
  level: number
  onLevelChange: (value: number) => void
  themes: string[]
  theme: string
  onThemeChange: (theme: string) => void
  modeGroups: ModeGroup[]
  mode: string
  onModeChange: (key: string) => void
  focusSection: string
  onFocusSection: (section: string) => void
  rangeNode?: ReactNode // container が描いた範囲セレクタ（単語/英英/単語例文で使用・#362/#364。未指定なら非表示）
  modeDesc: ReactNode
  poolCount: ReactNode
  endConditionNode?: ReactNode // container が描いた EndConditionSelect
  onStart: () => void
  bottomTab: string
  onBottomTabChange: (key: string) => void
  browseNode: ReactNode // container が描いた ItemList（一覧）or RecordsTable（記録）
}

export default function RankSectionView({
  levels,
  level,
  onLevelChange,
  themes,
  theme,
  onThemeChange,
  modeGroups,
  mode,
  onModeChange,
  focusSection,
  onFocusSection,
  rangeNode,
  modeDesc,
  poolCount,
  endConditionNode,
  onStart,
  bottomTab,
  onBottomTabChange,
  browseNode,
}: RankSectionViewProps) {
  return (
    <>
      <SectionLabel>レベル</SectionLabel>
      <div className="rank-select">
        <div className="rank-group">
          <div className="rank-btns">
            {levels.map((l) => (
              <button
                key={l.value}
                className={`rank-btn ${selCls(level === l.value, focusSection === 'level')}`}
                onClick={() => {
                  onLevelChange(l.value)
                  onFocusSection('level')
                }}
              >
                <span className="rank-no">{l.no}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionLabel>テーマ</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <div className="mode-btns">
            {themes.map((t) => (
              <button
                key={t}
                className={`mode-btn ${selCls(theme === t, focusSection === 'theme')}`}
                onClick={() => {
                  onThemeChange(t)
                  onFocusSection('theme')
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rangeNode}

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

      {endConditionNode}

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
