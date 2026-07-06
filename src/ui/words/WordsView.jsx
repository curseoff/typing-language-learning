// 単語問題の画面（container）：入力モードと4択クイズを振り分け、useWords/useWordQuiz を呼ぶ。
// HUD 値（endHudStat）を content で算出し、@tll/ui の WordTypeView/WordQuizView（presenter）へ渡す。
// 結果は共有 PlayResultView へ、記録詳細モーダル（useRecordDetail）は WordResult container で配線。
// 外部 API（words/level/theme/mode/seed/levelLabel/modeLabel/endCondition/onExit）は不変。
import { WordTypeView, WordQuizView, PlayResultView } from '@tll/ui'
import { useWords } from '../../application/useWords.js'
import { useWordQuiz } from '../../application/useWordQuiz.js'
import { wordRecKey } from '../../application/records.js'
import { endHudStat } from '../../content/endConditions.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'

export default function WordsView({ words, level, theme, mode, seed, levelLabel, modeLabel, endCondition, onExit }) {
  const metaSub = `${modeLabel} / ${theme}`
  return mode.startsWith('quiz') ? (
    <QuizView
      words={words}
      level={level}
      theme={theme}
      mode={mode}
      dir={mode === 'quiz-ja' ? 'ja' : 'en'}
      seed={seed}
      levelLabel={levelLabel}
      metaSub={metaSub}
      endCondition={endCondition}
      onExit={onExit}
    />
  ) : (
    <TypeView
      words={words}
      level={level}
      theme={theme}
      mode={mode}
      seed={seed}
      levelLabel={levelLabel}
      metaSub={metaSub}
      endCondition={endCondition}
      onExit={onExit}
    />
  )
}

// 単語の記録ランキング（useRecordDetail フックを使うため container 側）。finished 時だけマウント。
function WordResult({ result, records, level, theme, mode, onRetry, onExit }) {
  const list = records[wordRecKey(level, theme, mode, result.endCondition)] || []
  const { open, modal } = useRecordDetail()
  const isQuiz = mode.startsWith('quiz')
  return (
    <PlayResultView
      result={result}
      list={list}
      isQuiz={isQuiz}
      onRetry={onRetry}
      onExit={onExit}
      onRowClick={(r, rank) => open(r, rank, { rankText: '単語', list, isQuiz })}
      modal={modal}
    />
  )
}

// 入力モード（英語/日本語/英語・日本語）。文章モードと同じ上部フロー＋下部本文。
function TypeView({ words, level, theme, mode, seed, levelLabel, metaSub, endCondition, onExit }) {
  const w = useWords({ allWords: words, level, theme, mode, seed, endCondition, onExit })
  // items 制の HUD 進捗＝完了語数（segIndex）、life 制は残りライフ（missedItems）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: w.elapsedSec, keys: w.typedKeys, items: w.segIndex, missedItems: w.missedItems })
  // 時間制はフックの滑らかな progress を維持し、文字数制/問題数制は endStat 側（打鍵/問題基準）へ切替える。
  const progress = (endCondition?.kind ?? 'time') === 'time' ? w.progress : endStat.progress

  return (
    <WordTypeView
      levelLabel={levelLabel}
      metaSub={metaSub}
      finished={w.finished}
      resultNode={
        <WordResult
          result={w.result}
          records={w.records}
          level={level}
          theme={theme}
          mode={mode}
          onRetry={w.restart}
          onExit={onExit}
        />
      }
      typedKeys={w.typedKeys}
      liveSpeed={w.liveSpeed}
      mistakes={w.mistakes}
      endStatLabel={endStat.label}
      endStatValue={endStat.value}
      progress={progress}
      segments={w.segments}
      segIndex={w.segIndex}
      segInput={w.segInput}
      hasError={w.hasError}
    />
  )
}

// 4択クイズ（dir='en':英語訳 / 'ja':日本語訳）
function QuizView({ words, level, theme, mode, dir, seed, levelLabel, metaSub, endCondition, onExit }) {
  const q = useWordQuiz({ words, level, theme, dir, mode, seed, endCondition, onExit })
  // items 制の HUD 進捗＝完答した設問数（index）、life 制は残りライフ（missedItems）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: q.elapsedSec, keys: q.typedKeys, items: q.index, missedItems: q.missedItems })

  return (
    <WordQuizView
      levelLabel={levelLabel}
      metaSub={metaSub}
      finished={q.finished}
      resultNode={
        <WordResult
          result={q.result}
          records={q.records}
          level={level}
          theme={theme}
          mode={mode}
          onRetry={q.restart}
          onExit={onExit}
        />
      }
      dir={dir}
      typedKeys={q.typedKeys}
      correct={q.correct}
      mistakes={q.mistakes}
      endStatLabel={endStat.label}
      endStatValue={endStat.value}
      progress={endStat.progress}
      prompt={q.question.prompt}
      promptKana={q.question.promptKana}
      options={q.question.options}
      input={q.input}
      picked={q.picked}
      hasError={q.hasError}
      onPick={q.pick}
      onAdvance={q.advance}
    />
  )
}
