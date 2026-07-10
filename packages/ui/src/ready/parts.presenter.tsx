// スタート画面の共有プリミティブ（presenter）。各種類 Section から使う小さな部品・純粋ヘルパ。
// content 依存（dictLevelLabel/THEME_OPTIONS）や container（WordRecords）は app 側に残す。
import type { ReactNode } from 'react'

export interface Mode {
  key: string
  label: string
}

// 選択状態のクラス。フォーカス行の選択＝青枠(sel-focus)、非フォーカス行の選択＝青背景(sel)。
export const selCls = (selected: boolean, focused: boolean): string =>
  selected ? (focused ? 'sel-focus' : 'sel') : ''

export interface ModeButtonsProps {
  modes: Mode[]
  value: string
  onChange: (key: string) => void
  focused: boolean
}

export function ModeButtons({ modes, value, onChange, focused }: ModeButtonsProps) {
  return (
    <div className="mode-btns">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`mode-btn ${selCls(value === m.key, focused)}`}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export interface SectionLabelProps {
  children: ReactNode
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <div className="section-label">{children}</div>
}

export interface BottomTabsProps {
  value: string
  onChange: (key: string) => void
  focused: boolean
}

// 下部の「記録ランキング / 収録一覧」切り替え
export function BottomTabs({ value, onChange, focused }: BottomTabsProps) {
  return (
    <div className="bottom-tabs">
      {(
        [
          ['records', '記録ランキング'],
          ['list', '収録一覧'],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          className={`bottom-tab ${selCls(value === k, focused)}`}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export interface StartRowProps {
  onStart: () => void
}

export function StartRow({ onStart }: StartRowProps) {
  return (
    <>
      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="key-hint">
        <kbd>↑</kbd> <kbd>↓</kbd> 項目 / <kbd>←</kbd> <kbd>→</kbd> 選択 / <kbd>Enter</kbd> スタート
      </p>
    </>
  )
}
