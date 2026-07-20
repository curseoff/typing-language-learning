// マラソンのプレイ画面（バッジ・ステータス・本文・ヒントを合成）。
import { modeLabel } from '../../content/modes.js'
import { endHudStat } from '../../content/endConditions.js'
import { hudEndFor } from '../../domain/session/learningSequence.service.js'
import { StatsRow } from '../shared/index.js'
import TopFlow from './TopFlow.presenter.jsx'
import TranslateView from './TranslateView.presenter.jsx'

export default function MarathonView({
  mode,
  rankText,
  gloss,
  segments,
  segIndex,
  segInput,
  hasError,
  clozeRevealed,
  typedKeys,
  mistakes,
  missedItems,
  liveSpeed,
  elapsedSec,
  endCondition,
  learningMode = 'normal',
  versus = false,
}) {
  const currentSeg = segments[segIndex]
  // #406 cloze かつ問題数制は目標2倍＝HUD の分母も2倍にして finish（useMarathon）と一致させる。
  const hudEnd = hudEndFor(endCondition, learningMode)
  // items 制の HUD 進捗＝完了問題数（segIndex＝確定済みセグ数）、life 制は残りライフ（missedItems）。time/chars は不変。
  const endStat = endHudStat(hudEnd, { elapsedSec, keys: typedKeys, items: segIndex, missedItems })
  return (
    <div className="game">
      {/* #439 対戦は PlayMeta/StatsRow を出さない（上部の独立ヘッダバーへ集約）。solo は従来どおり出す。 */}
      {!versus && (
        <div className="play-meta">
          <span className="meta-badge rank">{rankText}</span>
          <span className="meta-badge mode">{modeLabel(mode)}</span>
        </div>
      )}

      {!versus && (
        <StatsRow
          stats={[
            { label: 'タイピング数', value: `${typedKeys}` },
            { label: '速度', value: `${liveSpeed} 打/分` },
            { label: 'ミス', value: mistakes },
            { label: endStat.label, value: endStat.value },
          ]}
          progress={endStat.progress}
        />
      )}

      {currentSeg?.word && (
        <p className="seg-word">
          単語 <strong>{currentSeg.word}</strong>
          {gloss?.[currentSeg.word] && (
            <span className="seg-word-ja">（{gloss[currentSeg.word]}）</span>
          )}
        </p>
      )}

      {currentSeg?.translate ? (
        <TranslateView
          segments={segments}
          segIndex={segIndex}
          segInput={segInput}
          hasError={hasError}
        />
      ) : (
        currentSeg && (
          <TopFlow
            segments={segments}
            segIndex={segIndex}
            segInput={segInput}
            hasError={hasError}
            clozeRevealed={clozeRevealed}
            ticker
          />
        )
      )}

      <p className="hint">
        {currentSeg?.translate
          ? 'チップを参考に訳を入力。正しく打つと文字が現れます。'
          : '英文はそのまま、和文はローマ字で（shi/si など自由）。正しく打つまで次に進めません。'}
        <kbd>Esc</kbd> で中断してトップへ。
      </p>
    </div>
  )
}
