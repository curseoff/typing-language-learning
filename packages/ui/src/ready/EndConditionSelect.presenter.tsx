// 終了条件セレクタ（presenter）。2段構成：上段=種別（時間/文字数/…）、下段=選択中種別の値。
// content 依存（END_KINDS/endValueLabel 等）は container（app 側）で解決し、ここは props だけで描く。
// ↑↓で行移動（種別行 endKind / 値行 end）、←→で行内の選択移動＝既存ナビ流儀に合わせる。
// 既存 mode-btn/selCls/SectionLabel を流用（新規CSS・ハードコード色なし）。
import { selCls, SectionLabel } from './parts.presenter'

export interface EndKindOption {
  kind: string
  label: string
}

export interface EndConditionSelectProps {
  kinds: EndKindOption[] // 種別チップ（時間 / 文字数 / …）
  kind: string // 選択中の種別
  value: number | null // 選択中の値
  values: number[] // 選択中種別が取りうる値（空なら値チップ行を出さない）
  valueLabel: (kind: string, value: number) => string // 値チップのラベル
  focusSection: string // フォーカス中の行（'endKind' | 'end'）
  onChange: (kind: string) => void // 種別チップを押した（container が既定値へ整える）
  onChangeValue: (value: number) => void // 値チップを押した
  onFocusSection: (section: string) => void
}

export default function EndConditionSelect({
  kinds,
  kind,
  value,
  values,
  valueLabel,
  focusSection,
  onChange,
  onChangeValue,
  onFocusSection,
}: EndConditionSelectProps) {
  return (
    <>
      <SectionLabel>終了条件</SectionLabel>
      <div className="mode-select">
        {/* 上段：種別（時間 / 文字数 / …）。切替でその種別の既定値へ */}
        <div className="mode-group">
          <div className="mode-btns">
            {kinds.map((k) => (
              <button
                key={k.kind}
                className={`mode-btn ${selCls(kind === k.kind, focusSection === 'endKind')}`}
                onClick={() => {
                  onChange(k.kind)
                  onFocusSection('endKind')
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        {/* 下段：選択中種別の値。値が無い種別（endless）は行ごと出さない */}
        {values.length > 0 && (
          <div className="mode-group">
            <div className="mode-btns">
              {values.map((v) => (
                <button
                  key={v}
                  className={`mode-btn ${selCls(value === v, focusSection === 'end')}`}
                  onClick={() => {
                    onChangeValue(v)
                    onFocusSection('end')
                  }}
                >
                  {valueLabel(kind, v)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
