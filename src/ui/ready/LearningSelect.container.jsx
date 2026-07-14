// 学習モード（通常/穴埋め）の選択（#402）。単語/単語例文/英英で、通常入力（both/en/ja）の
// ときだけ表示する。骨格は @tll/ui の SectionLabel/ModeButtons を流用（EndConditionSelect と同型）。
import { SectionLabel, ModeButtons } from './parts.container.jsx'
import { LEARNING_MODES, learningLabel, learningDesc, supportsLearning } from '../../content/learningModes.js'

const LEARNING_OPTIONS = LEARNING_MODES.map((k) => ({ key: k, label: learningLabel(k) }))

// inputMode が通常入力でなければ何も出さない（翻訳・4択では非表示）。
export default function LearningSelect({ inputMode, learningMode, onChange, focusSection, onFocusSection }) {
  if (!supportsLearning(inputMode)) return null
  return (
    <>
      <SectionLabel>学習モード</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <ModeButtons
            modes={LEARNING_OPTIONS}
            value={learningMode}
            focused={focusSection === 'learning'}
            onChange={(k) => {
              onChange(k)
              onFocusSection('learning')
            }}
          />
        </div>
      </div>
      <p className="mode-desc">{learningDesc(learningMode)}</p>
    </>
  )
}
