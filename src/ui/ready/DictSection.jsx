// 英英辞典タブ（container）：レベル・テーマ・モード（入力/4択）の選択＋記録/収録一覧。
// 表示の骨格は @tll/ui の RankSectionView（presenter）。ここは content（英英データ・件数・レベル）・
// application（dictRanking）を読み、選択肢・収録件数・一覧/記録ノードを組み立てて渡す。
// 外部 API（dictLevel/onDictLevelChange 等）は従来どおり維持し、呼び出し側は無改変で通る。
import { useState, useEffect } from 'react'
import { RankSectionView } from '@tll/ui'
import { DICT_MODES, DICT_COUNTS, DICT_AVAILABLE_LEVELS, loadDict } from '../../content/dictionary.js'
import { dictRanking } from '../../application/records.js'
import ItemList from './ItemList.jsx'
import EndConditionSelect from './EndConditionSelect.jsx'
import { endConditionSummary } from '../../content/endConditions.js'
import { WordRecords, THEME_OPTIONS, dictLevelLabel } from './parts.jsx'

const DICT_QUIZ = DICT_MODES.filter((m) => m.key === 'quiz' || m.key === 'pick')
const DICT_INPUT = DICT_MODES.filter((m) => m.key === 'both' || m.key === 'en' || m.key === 'ja')
const DICT_MODE_GROUPS = [
  { course: '通常入力', modes: DICT_INPUT },
  { course: '4択', modes: DICT_QUIZ },
]
const DICT_LEVEL_OPTIONS = DICT_AVAILABLE_LEVELS.map((lv) => ({
  value: lv,
  no: `L${lv}`,
  label: dictLevelLabel(lv),
}))

// 英英の収録一覧。英英データを遅延読み込みしてレベル×テーマで絞る。
function DictList({ level, theme, mode }) {
  const [dict, setDict] = useState(null)
  useEffect(() => {
    let alive = true
    loadDict().then((arr) => alive && setDict(arr))
    return () => {
      alive = false
    }
  }, [])
  if (!dict) return <p className="pool-count">読み込み中…</p>
  const items = dict.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  return <ItemList items={items} type="dict" mode={mode} />
}

function dictModeDesc(key, end) {
  switch (key) {
    case 'both':
      return '1語ごとに見出し語の英語の定義→その和訳を続けて入力。'
    case 'pick':
      return `英単語＋意味を見て、4つの説明文から合うものを入力して選ぶ。${end}。`
    case 'en':
      return '見出し語の英語の定義を入力（和訳は参考表示）。'
    case 'ja':
      return '見出し語の和訳をローマ字で入力（英語の定義は参考）。'
    default:
      return `英語の定義を読んで、4つの英単語から正解を入力（4択）。回答後に和訳を表示。${end}。`
  }
}

export default function DictSection({
  dictLevel,
  dictTheme,
  dictMode,
  onDictLevelChange,
  onDictThemeChange,
  onDictModeChange,
  focusSection,
  onFocusSection,
  bottomTab,
  onBottomTabChange,
  onStart,
  endCondition,
  onEndConditionChange,
}) {
  const browseNode =
    bottomTab === 'list' ? (
      <DictList level={dictLevel} theme={dictTheme} mode={dictMode} />
    ) : (
      <WordRecords
        list={dictRanking(dictLevel, dictTheme, dictMode, endCondition)}
        isQuiz={dictMode === 'quiz' || dictMode === 'pick'}
        rankText={`英英 ${dictLevelLabel(dictLevel)} ${dictTheme}`}
        endCondition={endCondition}
      />
    )
  return (
    <RankSectionView
      levels={DICT_LEVEL_OPTIONS}
      level={dictLevel}
      onLevelChange={onDictLevelChange}
      themes={THEME_OPTIONS}
      theme={dictTheme}
      onThemeChange={onDictThemeChange}
      modeGroups={DICT_MODE_GROUPS}
      mode={dictMode}
      onModeChange={onDictModeChange}
      focusSection={focusSection}
      onFocusSection={onFocusSection}
      modeDesc={dictModeDesc(dictMode, endConditionSummary(endCondition))}
      poolCount={`この条件の収録: ${DICT_COUNTS[dictLevel]?.[dictTheme] ?? 0} 語`}
      endConditionNode={
        <EndConditionSelect
          endCondition={endCondition}
          onChange={onEndConditionChange}
          focusSection={focusSection}
          onFocusSection={onFocusSection}
        />
      }
      onStart={onStart}
      bottomTab={bottomTab}
      onBottomTabChange={onBottomTabChange}
      browseNode={browseNode}
    />
  )
}
