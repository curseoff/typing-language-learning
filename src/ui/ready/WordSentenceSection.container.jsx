// 単語例文タブ（container）：レベル・テーマ・モードの選択＋記録/収録一覧。
// 表示の骨格は @tll/ui の RankSectionView（presenter）。ここは content（例文データ・件数・モード）・
// domain（recKey）を読み、選択肢・収録件数・一覧/記録ノードを組み立てて渡す。
// 外部 API（mode/onModeChange/wsentLevel 等）は従来どおり維持し、呼び出し側は無改変で通る。
import { useState, useEffect } from 'react'
import { RankSectionView } from '@tll/ui'
import { MODES, modeDesc } from '../../content/modes.js'
import { WSENT_COUNTS, loadWsentLevel, loadWsentThemes } from '../../content/wordSentences/index.js'
import { WORD_LEVELS, loadWords } from '../../content/words.js'
import { recKey } from '../../domain/records/ranking.service.js'
import { rangeLabel, RANGE_SIZE } from '../../domain/words/wordRange.service.js'
import { filterWsentByTheme } from '../../domain/words/wsentSet.service.js'
import { headwordFreqMap, sliceByHeadwordFreq } from '../../application/headwordFreqSlice.policy.js'
import RecordsTable from '../result/RecordsTable.container.jsx'
import ItemList from './ItemList.container.jsx'
import EndConditionSelect from './EndConditionSelect.container.jsx'
import { endConditionSummary } from '../../content/endConditions.js'
import { RangeStepper, THEME_OPTIONS } from './parts.container.jsx'

const WSENT_LEVEL_OPTIONS = WORD_LEVELS.map((l) => ({ value: l.level, no: `L${l.level}`, label: l.label }))
// モードは MODES の group 単位でまとめる（course=group 名）。
const WSENT_MODE_GROUPS = [...new Set(MODES.map((m) => m.group))].map((g) => ({
  course: g,
  modes: MODES.filter((m) => m.group === g),
}))

// 単語例文の収録一覧。レベルの例文＋テーママップを遅延読み込みしてから ItemList を出す（初回バンドルに含めない）。
// 読み込んだ結果は対象レベルと一緒に持ち、レベルが変わった直後は「読み込み中…」を表示する。テーマで絞り込む。
// #364 範囲(range)選択時はその 100 文（見出し語の freq 順）だけを一覧に出す。freq は単語データ側に
// あるため range 時のみ単語(level 分)を読んで freqMap（Map(en→freq)）を作る。
function WsentList({ level, theme, mode, range }) {
  const [loaded, setLoaded] = useState(null) // { level, items, themes }
  const [freqMap, setFreqMap] = useState(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadWsentLevel(level), loadWsentThemes()]).then(
      ([arr, themes]) => alive && setLoaded({ level, items: arr, themes: themes[level] ?? {} }),
    )
    return () => {
      alive = false
    }
  }, [level])
  useEffect(() => {
    if (range == null) return
    let alive = true
    loadWords(level).then((ws) => alive && setFreqMap(headwordFreqMap(ws)))
    return () => {
      alive = false
    }
  }, [range, level])
  if (!loaded || loaded.level !== level || (range != null && !freqMap))
    return <p className="pool-count">読み込み中…</p>
  const filtered = filterWsentByTheme(loaded.items, theme, loaded.themes)
  const items = sliceByHeadwordFreq(filtered, range, freqMap)
  return <ItemList items={items} type="marathon" mode={mode} />
}

export default function WordSentenceSection({
  mode,
  onModeChange,
  wsentLevel,
  onWsentLevelChange,
  wsentTheme,
  onWsentThemeChange,
  wsentRange,
  onWsentRangeChange,
  focusSection,
  onFocusSection,
  bottomTab,
  onBottomTabChange,
  onStart,
  records,
  endCondition,
  onEndConditionChange,
}) {
  // #364 範囲選択時は記録も収録一覧も「その範囲だけ」を映す（範囲別の達成度＝範囲別キーで引く）。
  const rangeText = wsentRange != null ? ` ${rangeLabel(wsentRange, RANGE_SIZE, WSENT_COUNTS[wsentLevel]?.[wsentTheme] ?? 0)}` : ''
  const browseNode =
    bottomTab === 'list' ? (
      <WsentList level={wsentLevel} theme={wsentTheme} mode={mode} range={wsentRange} />
    ) : (
      <RecordsTable
        records={records[recKey(mode, wsentLevel, 'wsent', wsentTheme, endCondition, wsentRange)]}
        modeKey={mode}
        rankText={`単語例文 L${wsentLevel} / ${wsentTheme}${rangeText}`}
        endCondition={endCondition}
      />
    )
  return (
    <RankSectionView
      levels={WSENT_LEVEL_OPTIONS}
      level={wsentLevel}
      onLevelChange={onWsentLevelChange}
      themes={THEME_OPTIONS}
      theme={wsentTheme}
      onThemeChange={onWsentThemeChange}
      modeGroups={WSENT_MODE_GROUPS}
      mode={mode}
      onModeChange={onModeChange}
      focusSection={focusSection}
      onFocusSection={onFocusSection}
      rangeNode={
        <RangeStepper
          total={WSENT_COUNTS[wsentLevel]?.[wsentTheme] ?? 0}
          range={wsentRange}
          onChange={onWsentRangeChange}
          unit="文"
        />
      }
      modeDesc={`${modeDesc(mode)} 単語を使った例文を打ちます。${endConditionSummary(endCondition)}します。`}
      poolCount={`この条件の収録: ${WSENT_COUNTS[wsentLevel]?.[wsentTheme] ?? 0} 文`}
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
