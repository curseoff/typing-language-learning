// 単語タブ（container）：レベル・テーマ・モード（入力/4択）の選択＋記録/収録一覧。
// 表示の骨格は @tll/ui の RankSectionView（presenter）。ここは content（単語データ・件数）・
// application（wordRanking）を読み、選択肢・収録件数・一覧/記録ノードを組み立てて渡す。
// 外部 API（wordLevel/onWordLevelChange 等）は従来どおり維持し、呼び出し側は無改変で通る。
import { useState, useEffect } from 'react'
import { RankSectionView } from '@tll/ui'
import { WORD_LEVELS, WORD_MODES, WORD_COUNTS, loadWords } from '../../content/words.js'
import { wordRanking } from '../../application/records.service.js'
import ItemList from './ItemList.container.jsx'
import EndConditionSelect from './EndConditionSelect.container.jsx'
import { endConditionSummary } from '../../content/endConditions.js'
import { WordRecords, THEME_OPTIONS, dictLevelLabel } from './parts.container.jsx'

const WORD_INPUT = WORD_MODES.filter((m) => !m.key.startsWith('quiz'))
const WORD_QUIZ = WORD_MODES.filter((m) => m.key.startsWith('quiz'))
const WORD_MODE_GROUPS = [
  { course: '通常入力', modes: WORD_INPUT },
  { course: '4択', modes: WORD_QUIZ },
]
const WORD_LEVEL_OPTIONS = WORD_LEVELS.map((l) => ({ value: l.level, no: `W${l.level}`, label: l.label }))

// 単語の収録一覧。単語データを遅延読み込みしてレベル×テーマで絞る。
function WordsList({ level, theme, mode }) {
  const [words, setWords] = useState(null)
  useEffect(() => {
    let alive = true
    loadWords().then((arr) => alive && setWords(arr))
    return () => {
      alive = false
    }
  }, [])
  if (!words) return <p className="pool-count">読み込み中…</p>
  const items = words.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  return <ItemList items={items} type="words" mode={mode} />
}

function wordModeDesc(key, end) {
  switch (key) {
    case 'quiz-en':
      return `和訳を見て、4つの英単語から正解を入力（4択）。${end}。`
    case 'quiz-ja':
      return `英単語を見て、4つの和訳から正解をローマ字入力（4択）。${end}。`
    case 'ja':
      return `英単語を見て和訳をローマ字入力。${end}。`
    case 'both':
      return `1語ごとに英語→その和訳を入力。${end}。`
    default:
      return `和訳を見て英単語を入力。${end}。`
  }
}

export default function WordsSection({
  wordLevel,
  wordTheme,
  wordMode,
  onWordLevelChange,
  onThemeChange,
  onWordModeChange,
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
      <WordsList level={wordLevel} theme={wordTheme} mode={wordMode} />
    ) : (
      <WordRecords
        list={wordRanking(wordLevel, wordTheme, wordMode, endCondition)}
        isQuiz={wordMode.startsWith('quiz')}
        rankText={`単語 ${dictLevelLabel(wordLevel)} ${wordTheme}`}
        endCondition={endCondition}
      />
    )
  return (
    <RankSectionView
      levels={WORD_LEVEL_OPTIONS}
      level={wordLevel}
      onLevelChange={onWordLevelChange}
      themes={THEME_OPTIONS}
      theme={wordTheme}
      onThemeChange={onThemeChange}
      modeGroups={WORD_MODE_GROUPS}
      mode={wordMode}
      onModeChange={onWordModeChange}
      focusSection={focusSection}
      onFocusSection={onFocusSection}
      modeDesc={wordModeDesc(wordMode, endConditionSummary(endCondition))}
      poolCount={`この条件の収録: ${WORD_COUNTS[wordLevel]?.[wordTheme] ?? 0} 語`}
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
