// 単語タブ（container）：レベル・テーマ・モード（入力/4択）の選択＋記録/収録一覧。
// 表示の骨格は @tll/ui の RankSectionView（presenter）。ここは content（単語データ・件数）・
// application（wordRanking）を読み、選択肢・収録件数・一覧/記録ノードを組み立てて渡す。
// 外部 API（wordLevel/onWordLevelChange 等）は従来どおり維持し、呼び出し側は無改変で通る。
import { useState, useEffect } from 'react'
import { RankSectionView } from '@tll/ui'
import { WORD_LEVELS, WORD_MODES, WORD_COUNTS, loadWords } from '../../content/words.js'
import { wordRanking } from '../../application/records.service.js'
import { rangeCount, rangeLabel, poolForRange } from '../../domain/words/wordRange.service.js'
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
// #362 範囲(range)選択時はその100語（freq 順・poolForRange）だけを一覧に出す。
function WordsList({ level, theme, mode, range }) {
  const [words, setWords] = useState(null)
  useEffect(() => {
    let alive = true
    loadWords().then((arr) => alive && setWords(arr))
    return () => {
      alive = false
    }
  }, [])
  if (!words) return <p className="pool-count">読み込み中…</p>
  const items =
    range != null
      ? poolForRange(words, level, theme, range)
      : words.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  return <ItemList items={items} type="words" mode={mode} />
}

// #362 単語の固定範囲セレクタ（数値ステッパー）。範囲数が最大152（L4/すべて）になり得るので
// ドロップダウンやボタン羅列でなく ◀ ラベル(n/総数) ▶ のステッパーにする（本人決定・毎回同じ範囲）。
// 状態は null=範囲指定なし（従来の全体ランダム）/ 1..count。最左（1 の手前）が「範囲指定なし」。
function WordRangeStepper({ level, theme, range, onChange }) {
  const total = WORD_COUNTS[level]?.[theme] ?? 0
  const count = rangeCount(total)
  const idx = range ?? 0 // 0=範囲指定なし
  const atStart = idx <= 0
  const atEnd = idx >= count
  const dec = () => onChange(idx <= 1 ? null : idx - 1) // 1→なし、なしで止まる
  const inc = () => onChange(idx >= count ? (count >= 1 ? count : null) : idx + 1) // なし→1、末尾で止まる
  const label = range == null ? '範囲指定なし（全体）' : `${rangeLabel(range, 100, total)} 語`
  const position = range == null ? `— / ${count}` : `${range} / ${count}`
  return (
    <>
      <div className="section-label">範囲（毎回同じ順で復習）</div>
      <div className="range-stepper">
        <button
          className="range-step-btn"
          onClick={dec}
          disabled={atStart}
          aria-label="前の範囲"
        >
          ◀
        </button>
        <div className="range-current">
          <span className="range-label">{label}</span>
          <span className="range-pos">{position}</span>
        </div>
        <button
          className="range-step-btn"
          onClick={inc}
          disabled={atEnd || count === 0}
          aria-label="次の範囲"
        >
          ▶
        </button>
      </div>
    </>
  )
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
  wordRange,
  onWordLevelChange,
  onThemeChange,
  onWordModeChange,
  onWordRangeChange,
  focusSection,
  onFocusSection,
  bottomTab,
  onBottomTabChange,
  onStart,
  endCondition,
  onEndConditionChange,
}) {
  // #362 範囲選択時は記録も収録一覧も「その範囲だけ」を映す（範囲別の達成度＝範囲別キーで引く）。
  const rangeText = wordRange != null ? ` ${rangeLabel(wordRange, 100, WORD_COUNTS[wordLevel]?.[wordTheme] ?? 0)}` : ''
  const browseNode =
    bottomTab === 'list' ? (
      <WordsList level={wordLevel} theme={wordTheme} mode={wordMode} range={wordRange} />
    ) : (
      <WordRecords
        list={wordRanking(wordLevel, wordTheme, wordMode, endCondition, wordRange)}
        isQuiz={wordMode.startsWith('quiz')}
        rankText={`単語 ${dictLevelLabel(wordLevel)} ${wordTheme}${rangeText}`}
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
      rangeNode={
        <WordRangeStepper
          level={wordLevel}
          theme={wordTheme}
          range={wordRange}
          onChange={onWordRangeChange}
        />
      }
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
