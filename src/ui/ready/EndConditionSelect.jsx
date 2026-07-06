// 終了条件セレクタ（container）。presenter の正本は @tll/ui。ここは content/endConditions.js から
// 種別・値・ラベルを解決し、presenter（表示専用）に props で渡す薄いラッパ。外部 API（endCondition/onChange/
// focusSection/onFocusSection）は従来どおり維持し、呼び出し側（各 Section）は無改変で通る。
import { EndConditionSelect as EndConditionSelectView } from '@tll/ui'
import { END_KINDS, endKind, endValueLabel, endConditionForKind } from '../../content/endConditions.js'

export default function EndConditionSelect({ endCondition, onChange, focusSection, onFocusSection }) {
  const kind = endCondition?.kind ?? 'time'
  const value = endCondition?.value ?? 60
  const values = endKind(kind).values ?? [] // endless は値を持たない（空配列＝値チップ行を出さない）
  return (
    <EndConditionSelectView
      kinds={END_KINDS}
      kind={kind}
      value={value}
      values={values}
      valueLabel={endValueLabel}
      focusSection={focusSection}
      onChange={(k) => onChange(endConditionForKind(k))}
      onChangeValue={(v) => onChange({ kind, value: v })}
      onFocusSection={onFocusSection}
    />
  )
}
