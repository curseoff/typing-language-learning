// 物語モードの画面（container）：useStory（状態機械・キー入力配線・記録保存）を呼び、
// domain（guideText/consumedWords/kanjiDone/segMatches/lookahead/storyFlowProgress）で
// 進捗・選択肢ビュー・翻訳入力ビューを算出して @tll/ui の StoryView（presenter）へ渡す。
// 記録ランキング（useRecordDetail フックを使うモーダル）は container 側で描いて node で渡す。
// 外部 API（mode/modeLabel/storyId/start/onExit）は従来どおり維持。
import { StoryView as StoryViewPresenter } from '@tll/ui'
import { useStory } from '../../application/useStory.js'
import { storyById } from '../../content/stories/index.js'
import { lookahead } from '../../domain/story/navigation.service.js'
import { storyFlowProgress } from '../../domain/story/flowProgress.service.js'
import { segMatches } from '../../domain/typing/units.service.js'
import { consumedWords, guideText, kanjiDone } from '../../domain/typing/progress.service.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'
import { useOpenDetail } from '../result/RecordDetailContext.context.jsx'

// 物語の記録ランキング（速い順・最大15件、分岐により長さは異なる）。useRecordDetail フックを
// 使うため container 側に置き、presenter へは描画済みノードとして渡す。
function StoryRecords({ list, highlight, rankText }) {
  // #360 App 配下では openDetail（URL 同期の単一オーバーレイ）・未配線ならローカルモーダルへ。
  const openDetail = useOpenDetail()
  const { open: localOpen, modal } = useRecordDetail()
  const open = openDetail ?? localOpen
  if (!list || list.length === 0) return null
  return (
    <div className="records">
      <h3>
        記録ランキング
        <span className="records-sub">（速い順・最大15件）</span>
      </h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>速度</th>
            <th>正確率</th>
            <th>時間</th>
            <th>エンド</th>
            <th>日時</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr
              key={i}
              className={`row-click ${highlight && r.date === highlight ? 'me' : ''}`}
              onClick={() => open(r, i + 1, { rankText, list, hasEnding: true })}
              title="クリックで記録の詳細"
            >
              <td>{i + 1}</td>
              <td className="speed">{r.speed} 打/分</td>
              <td>{r.accuracy}%</td>
              <td>{r.seconds}秒</td>
              <td>{r.endLabel}</td>
              <td className="date">{r.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!openDetail && modal}
    </div>
  )
}

export default function StoryView({ mode, modeLabel, storyId, start, onExit }) {
  const story = storyById(storyId)
  const {
    nodes,
    node,
    stage,
    units,
    unitIndex,
    input,
    hasError,
    found,
    lang,
    choiceSegs,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    result,
    records,
    restart,
  } = useStory({ mode, storyId, start, onExit })

  // バー＝現在の行（または入力中の選択肢）の進捗
  let barTarget = ''
  if (stage === 'text') barTarget = guideText(units[unitIndex], input)
  else if (stage === 'choice') {
    const s = choiceSegs.find((cs) => segMatches(cs, input))
    barTarget = s ? guideText(s, input) : ''
  }
  const barProgress = barTarget.length ? Math.min(1, input.length / barTarget.length) : 0

  // 英語/日本語フロー（翻訳モード以外で表示）。問題入力中は wsent と同じカード型(ticker)、
  // 選択肢表示中は以前の段組み(wrap)に切り替える。
  const isTranslate = mode === 'en-tr' || mode === 'ja-tr'
  const isBoth = mode === 'both'
  const activeType = units[unitIndex]?.type
  const flowItems = [node, ...lookahead(node, nodes)]
  const { enDone, jaDone, jaKanaDone, activeRow } = storyFlowProgress(node, {
    stage,
    mode,
    activeType,
    input,
  })

  // 翻訳モードの入力欄（原文＋伏せ字）。seg.translate 前提（翻訳モードの units は translate）。
  const activeInput =
    isTranslate && units[unitIndex]
      ? (() => {
          const seg = units[unitIndex]
          return {
            source: seg.type === 'en' ? seg.ja : seg.en,
            chips: seg.chips,
            used: consumedWords(seg, input),
            target: guideText(seg, input),
            pos: input.length,
          }
        })()
      : null

  // 分岐選択肢のビュー（打鍵中の照合・進捗を domain で算出）。
  const choices =
    stage === 'choice'
      ? node.choices.map((c, i) => {
          const seg = choiceSegs[i]
          const matched = segMatches(seg, input)
          return {
            key: 'ABC'[i],
            lang,
            en: c.en,
            ja: c.ja,
            matched,
            enDone: lang === 'en' && matched ? input.length : 0,
            enCursor: matched ? input.length : -1,
            jaDone: lang === 'ja' && matched ? kanjiDone(seg, input) : 0,
            hasError: matched && hasError,
          }
        })
      : null

  const unitProgress =
    units.length > 1
      ? {
          current: unitIndex + 1,
          total: units.length,
          typeLabel: units[unitIndex].type === 'en' ? '英語' : '日本語',
        }
      : null

  return (
    <StoryViewPresenter
      storyTitle={story.title}
      modeLabel={modeLabel}
      foundCount={found.length}
      endingCount={story.endingCount}
      stage={stage}
      hasError={hasError}
      onRestart={restart}
      onExit={onExit}
      endLabel={node.endLabel}
      endEn={node.en}
      endJa={node.ja}
      result={result}
      segStats={result?.segStats}
      recordsNode={
        <StoryRecords list={records} highlight={result?.date} rankText={story.title} />
      }
      typedKeys={typedKeys}
      liveSpeed={liveSpeed}
      mistakes={mistakes}
      elapsedSec={elapsedSec}
      barProgress={barProgress}
      showFlow={!isTranslate}
      flowItems={flowItems}
      enDone={enDone}
      jaDone={jaDone}
      jaKanaDone={jaKanaDone}
      activeRow={activeRow}
      isBoth={isBoth}
      unitProgress={unitProgress}
      activeInput={activeInput}
      choices={choices}
    />
  )
}
