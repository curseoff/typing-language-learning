// ローマ字入力練習の画面（presenter）：useRomaji の state・ハンドラを props で受け、
// メタ表示／完了カード／プレイ中（ステータス・現在かなとローマ字ガイド・かな表）を描くだけ。
// 記録保存・キー入力配線・タイマーは container 側。
import { StatsRow } from '../shared/Stats'
import { Typed } from '../shared/Text'
import KanaTable from './KanaTable'

export interface RomajiViewProps {
  levelLabel: string
  rowIds: string[]
  current: string // 今打っているかな
  input: string // 現在かなのローマ字入力バッファ
  romaji: string // 現在かなの標準ローマ字（打鍵ガイド）
  keys: number
  liveSpeed: number
  mistakes: number
  elapsedSec: number
  hasError: boolean
  finished: boolean
  onRestart: () => void
  onExit: () => void
}

// input が romaji の先頭何文字と一致しているか（別綴りで分岐したら一致長で止める＝着色の目安）。
const matchedLen = (romaji: string, input: string) => {
  let i = 0
  while (i < romaji.length && i < input.length && romaji[i] === input[i]) i++
  return i
}

export default function RomajiView({
  levelLabel,
  rowIds,
  current,
  input,
  romaji,
  keys,
  liveSpeed,
  mistakes,
  elapsedSec,
  hasError,
  finished,
  onRestart,
  onExit,
}: RomajiViewProps) {
  return (
    <div className="game">
      <div className="play-meta">
        <span className="meta-badge rank">ローマ字入力</span>
        <span className="meta-badge mode">{levelLabel}</span>
      </div>

      {finished ? (
        <div className="result">
          <h2>完了！</h2>
          <div className="result-main">
            <div className="result-speed">{keys}</div>
            <div className="result-unit">かな数</div>
          </div>
          <div className="result-sub">
            <span>ミス {mistakes}</span>
            <span>{elapsedSec} / 60秒</span>
          </div>
          <div className="ending-actions">
            <button className="btn-primary" onClick={onRestart}>
              もう一度
            </button>
            <button className="story-exit" onClick={onExit}>
              トップへ
            </button>
          </div>
          <p className="key-hint">
            <kbd>Enter</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
          </p>
        </div>
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'かな数', value: `${keys}` },
              { label: '速度', value: `${liveSpeed} かな/分` },
              { label: 'ミス', value: mistakes },
              { label: '時間', value: `${elapsedSec} / 60秒` },
            ]}
            progress={Math.min(1, elapsedSec / 60)}
          />

          <div className="romaji-cue">
            <div className="romaji-kana">{current}</div>
            <div className="romaji-guide">
              <Typed text={romaji} done={matchedLen(romaji, input)} hasError={hasError} />
            </div>
          </div>

          <KanaTable current={current} rowIds={rowIds} />

          <p className="hint">
            表示されたかなを見て、ローマ字で打ちます。<kbd>Esc</kbd> で中断。
          </p>
        </>
      )}
    </div>
  )
}
