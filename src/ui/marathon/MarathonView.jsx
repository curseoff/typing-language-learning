// マラソンのプレイ画面（バッジ・ステータス・本文・ヒントを合成）。
import { modeLabel } from '../../content/modes.js'
import { TARGET_KEYS } from '../../domain/marathon/passage.js'
import { StatsRow } from '../shared/index.js'
import TopFlow from './TopFlow.jsx'
import TranslateView from './TranslateView.jsx'

export default function MarathonView({
  mode,
  rankText,
  gloss,
  segments,
  segIndex,
  segInput,
  hasError,
  typedKeys,
  mistakes,
  liveSpeed,
  elapsedSec,
}) {
  const currentSeg = segments[segIndex]
  return (
    <div className="game">
      <div className="play-meta">
        <span className="meta-badge rank">{rankText}</span>
        <span className="meta-badge mode">{modeLabel(mode)}</span>
      </div>

      <StatsRow
        stats={[
          { label: 'タイピング数', value: `${typedKeys} / ${TARGET_KEYS}` },
          { label: '速度', value: `${liveSpeed} 打/分` },
          { label: 'ミス', value: mistakes },
          { label: '時間', value: `${elapsedSec} 秒` },
        ]}
        progress={typedKeys / TARGET_KEYS}
      />

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
