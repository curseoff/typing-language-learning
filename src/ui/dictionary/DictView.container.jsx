// 英英辞典の画面（container）：単語4択 / 説明4択 / 英語入力 / 日本語入力 / 英語・日本語入力 を
// 振り分け、useDict/useDictQuiz を呼ぶ。HUD 値（endHudStat）・和訳（gloss/wordRuby）を content で
// 算出し、@tll/ui の DictTypeView/DictQuizView/DictPickView（presenter）へ渡す。結果は共有
// PlayResultView、記録詳細モーダル（useRecordDetail）は DictResult container で配線。
// 外部 API（dict/gloss/wordRuby/level/theme/mode/seed/levelLabel/modeLabel/endCondition/onExit）は不変。
import { DictTypeView, DictQuizView, DictPickView, PlayResultView } from '@tll/ui'
import { useDict } from '../../application/useDict.js'
import { useDictQuiz } from '../../application/useDictQuiz.js'
import { dictRecKey } from '../../application/records.service.js'
import { endHudStat } from '../../content/endConditions.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'
import { useOpenDetail } from '../result/RecordDetailContext.context.jsx'

// 外部 API に #364 range/freqMap を追加（range 時のみ freqMap＝Map(en→freq) を注入）。
export default function DictView({ dict, gloss, wordRuby, level, theme, mode, seed, range, freqMap, levelLabel, modeLabel, endCondition, onExit }) {
  const metaSub = `英英 / ${modeLabel} / ${theme}`
  if (mode === 'quiz') return <QuizView dict={dict} gloss={gloss} wordRuby={wordRuby} level={level} theme={theme} seed={seed} range={range} freqMap={freqMap} levelLabel={levelLabel} metaSub={metaSub} endCondition={endCondition} onExit={onExit} />
  if (mode === 'pick') return <PickView dict={dict} gloss={gloss} level={level} theme={theme} seed={seed} range={range} freqMap={freqMap} levelLabel={levelLabel} metaSub={metaSub} endCondition={endCondition} onExit={onExit} />
  return <TypeView dict={dict} gloss={gloss} level={level} theme={theme} mode={mode} seed={seed} range={range} freqMap={freqMap} levelLabel={levelLabel} metaSub={metaSub} endCondition={endCondition} onExit={onExit} />
}

// 英英の記録ランキング（useRecordDetail フックを使うため container 側）。finished 時だけマウント。
// #364 range モードの記録は範囲別キー（result.range）で引く＝一覧が範囲ごとに分かれる。
function DictResult({ result, records, level, theme, mode, onRetry, onExit }) {
  const list = records[dictRecKey(level, theme, mode, result.endCondition, result.range)] || []
  // #360 App 配下では openDetail（URL 同期の単一オーバーレイ）・未配線ならローカルモーダルへ。
  const openDetail = useOpenDetail()
  const { open: localOpen, modal } = useRecordDetail()
  const open = openDetail ?? localOpen
  const isQuiz = mode === 'quiz' || mode === 'pick' // 選択式＝正解数で表示
  return (
    <PlayResultView
      result={result}
      list={list}
      isQuiz={isQuiz}
      showWordCount={!isQuiz}
      onRetry={onRetry}
      onExit={onExit}
      onRowClick={(r, rank) => open(r, rank, { rankText: '英英', list, isQuiz })}
      modal={!openDetail && modal}
    />
  )
}

// 入力中のヒント文言。both は今打っているセグ(en/ja)に応じて切り替える。
function typeHint(mode, segType) {
  const t = mode === 'both' ? segType : mode
  if (t === 'ja') return '見出し語の和訳を入力。'
  return '見出し語の英語の定義を入力。'
}

// 英語入力（定義文を打つ）/ 日本語入力（和訳を打つ）。単語例文（マラソン）と同じ TopFlow で描画。
function TypeView({ dict, gloss, level, theme, mode, seed, range, freqMap, levelLabel, metaSub, endCondition, onExit }) {
  const d = useDict({ dict, level, theme, mode, seed, endCondition, range, freqMap, onExit })
  // items 制の HUD 進捗＝完了語数（segIndex）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: d.elapsedSec, keys: d.typedKeys, items: d.segIndex, missedItems: d.missedItems })

  return (
    <DictTypeView
      levelLabel={levelLabel}
      metaSub={metaSub}
      finished={d.finished}
      resultNode={
        <DictResult result={d.result} records={d.records} level={level} theme={theme} mode={mode} onRetry={d.restart} onExit={onExit} />
      }
      typedKeys={d.typedKeys}
      liveSpeed={d.liveSpeed}
      mistakes={d.mistakes}
      endStatLabel={endStat.label}
      endStatValue={endStat.value}
      progress={endStat.progress}
      word={d.word}
      wordJa={d.word ? gloss?.[d.word] : undefined}
      hintLead={typeHint(mode, d.segments[d.segIndex]?.type)}
      segments={d.segments}
      segIndex={d.segIndex}
      segInput={d.segInput}
      hasError={d.hasError}
    />
  )
}

// 4択（定義→英単語をタイプ/クリック）
function QuizView({ dict, gloss, wordRuby, level, theme, seed, range, freqMap, levelLabel, metaSub, endCondition, onExit }) {
  const q = useDictQuiz({ dict, level, theme, seed, endCondition, range, freqMap, onExit })
  // items 制の HUD 進捗＝完答した設問数（index）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: q.elapsedSec, keys: q.typedKeys, items: q.index, missedItems: q.missedItems })
  // 回答後、選んだ語（型 or クリック）の和訳をグロッサリから引いて見出し下に出す
  const pickedWord = q.input || q.picked?.display
  const pickedJa = q.picked !== null && pickedWord ? gloss?.[pickedWord] : null

  return (
    <DictQuizView
      levelLabel={levelLabel}
      metaSub={metaSub}
      finished={q.finished}
      resultNode={
        <DictResult result={q.result} records={q.records} level={level} theme={theme} mode="quiz" onRetry={q.restart} onExit={onExit} />
      }
      typedKeys={q.typedKeys}
      correct={q.correct}
      mistakes={q.mistakes}
      endStatLabel={endStat.label}
      endStatValue={endStat.value}
      progress={endStat.progress}
      prompt={q.question.prompt}
      promptJa={q.question.ja}
      pickedJa={pickedJa}
      options={q.question.options}
      wordRuby={wordRuby}
      input={q.input}
      picked={q.picked}
      hasError={q.hasError}
      onPick={q.pick}
      onAdvance={q.advance}
    />
  )
}

// 説明文4択：単語＋意味 → 合う説明文を「打って」選ぶ
function PickView({ dict, gloss, level, theme, seed, range, freqMap, levelLabel, metaSub, endCondition, onExit }) {
  const q = useDictQuiz({ dict, level, theme, kind: 'pick', seed, endCondition, range, freqMap, onExit })
  // items 制の HUD 進捗＝完答した設問数（index）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: q.elapsedSec, keys: q.typedKeys, items: q.index, missedItems: q.missedItems })

  return (
    <DictPickView
      levelLabel={levelLabel}
      metaSub={metaSub}
      finished={q.finished}
      resultNode={
        <DictResult result={q.result} records={q.records} level={level} theme={theme} mode="pick" onRetry={q.restart} onExit={onExit} />
      }
      typedKeys={q.typedKeys}
      correct={q.correct}
      mistakes={q.mistakes}
      endStatLabel={endStat.label}
      endStatValue={endStat.value}
      progress={endStat.progress}
      prompt={q.question.prompt}
      headJa={gloss?.[q.question.prompt]}
      options={q.question.options}
      input={q.input}
      picked={q.picked}
      hasError={q.hasError}
      onPick={q.pick}
      onAdvance={q.advance}
    />
  )
}
