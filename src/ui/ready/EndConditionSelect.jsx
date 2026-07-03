// 終了条件セレクタ。段1は「時間」のみ（30/60/120/180秒・既定60＝従来）。
// 将来 kind（文字数/問題数…）を足すときは、ここに種別タブを重ねられる素直な構造にしてある。
import { END_TIME_VALUES, timeEndCondition } from '../../content/endConditions.js'
import { selCls, SectionLabel } from './parts.jsx'

export default function EndConditionSelect({ endCondition, onChange, focusSection, onFocusSection }) {
  const value = endCondition?.value ?? 60
  return (
    <>
      <SectionLabel>終了条件</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <div className="mode-btns">
            {END_TIME_VALUES.map((v) => (
              <button
                key={v}
                className={`mode-btn ${selCls(value === v, focusSection === 'end')}`}
                onClick={() => {
                  onChange(timeEndCondition(v))
                  onFocusSection('end')
                }}
              >
                {v}秒
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
