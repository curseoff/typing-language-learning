// 終了条件セレクタ（#208 段2b）。2段構成：上段=種別（時間/文字数）、下段=選択中種別の値。
// 既定は時間60＝従来。種別チップを切替えると、その種別の既定値に値をセットする。
// ↑↓で行移動（種別行 endKind / 値行 end）、←→で行内の選択移動＝既存ナビ流儀に合わせる。
// 既存 mode-btn/selCls/SectionLabel を流用（新規CSS・ハードコード色なし）。
import { END_KINDS, endKind, endValueLabel, endConditionForKind } from '../../content/endConditions.js'
import { selCls, SectionLabel } from './parts.jsx'

export default function EndConditionSelect({ endCondition, onChange, focusSection, onFocusSection }) {
  const kind = endCondition?.kind ?? 'time'
  const value = endCondition?.value ?? 60
  const values = endKind(kind).values
  return (
    <>
      <SectionLabel>終了条件</SectionLabel>
      <div className="mode-select">
        {/* 上段：種別（時間 / 文字数）。切替でその種別の既定値へ */}
        <div className="mode-group">
          <div className="mode-btns">
            {END_KINDS.map((k) => (
              <button
                key={k.kind}
                className={`mode-btn ${selCls(kind === k.kind, focusSection === 'endKind')}`}
                onClick={() => {
                  onChange(endConditionForKind(k.kind))
                  onFocusSection('endKind')
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        {/* 下段：選択中種別の値（時間=秒 / 文字数=文字） */}
        <div className="mode-group">
          <div className="mode-btns">
            {values.map((v) => (
              <button
                key={v}
                className={`mode-btn ${selCls(value === v, focusSection === 'end')}`}
                onClick={() => {
                  onChange({ kind, value: v })
                  onFocusSection('end')
                }}
              >
                {endValueLabel(kind, v)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
