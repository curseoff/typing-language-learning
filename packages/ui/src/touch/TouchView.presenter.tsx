// タッチタイピング練習の画面（presenter）：useTouch の state・ハンドラを props で受け、
// メタ表示／完了カード／プレイ中（ステータス・打鍵ストリップ・指ガイド・キーボード）を描くだけ。
// 記録保存・キー入力配線・タイマーは container 側。
import { StatsRow } from '../shared/Stats.presenter'
import Keyboard, { type KeyboardPressed } from './Keyboard.presenter'
import { FINGER, FINGER_LABEL } from './keyboardLayout.util'

export interface TouchViewProps {
  levelLabel: string
  modeLabel?: string
  showTarget: boolean
  targets: string[]
  index: number
  target: string
  typedKeys: number
  liveSpeed: number
  mistakes: number
  elapsedSec: number
  hasError: boolean
  wrongKey: string | null
  pressed: KeyboardPressed
  finished: boolean
  onRestart: () => void
  onExit: () => void
}

export default function TouchView({
  levelLabel,
  modeLabel,
  showTarget,
  targets,
  index,
  target,
  typedKeys,
  liveSpeed,
  mistakes,
  elapsedSec,
  hasError,
  wrongKey,
  pressed,
  finished,
  onRestart,
  onExit,
}: TouchViewProps) {
  return (
    <div className="game">
      <div className="play-meta">
        <span className="meta-badge rank">タッチタイピング</span>
        <span className="meta-badge mode">{levelLabel}</span>
        {modeLabel ? <span className="meta-badge mode">{modeLabel}</span> : null}
      </div>

      {finished ? (
        <div className="result">
          <h2>完了！</h2>
          <div className="result-main">
            <div className="result-speed">{typedKeys}</div>
            <div className="result-unit">タイピング数</div>
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
              { label: 'タイピング数', value: `${typedKeys}` },
              { label: '速度', value: `${liveSpeed} 打/分` },
              { label: 'ミス', value: mistakes },
              { label: '時間', value: `${elapsedSec} / 60秒` },
            ]}
            progress={Math.min(1, elapsedSec / 60)}
          />

          <div className="touch-strip">
            <div
              className="strip-track"
              style={{ transform: `translateX(${-Math.max(0, index - 3) * 42}px)` }}
            >
              {targets.map((k, i) => {
                const cur = i === index
                const cls =
                  'strip-key' + (i < index ? ' done' : '') + (cur ? ` current fg-${FINGER[k]}` : '')
                return (
                  <span key={i} className={cls}>
                    {k.toUpperCase()}
                  </span>
                )
              })}
            </div>
          </div>

          <p className="touch-finger">使う指：{FINGER_LABEL[FINGER[target]]}</p>

          <Keyboard
            target={target}
            hasError={hasError}
            showTarget={showTarget}
            wrongKey={wrongKey}
            pressed={pressed}
          />

          <p className="hint">
            ハイライトされたキーを、対応する指で打ちます（画面を見ずに打てるように）。
            <kbd>Esc</kbd> で中断。
          </p>
        </>
      )}
    </div>
  )
}
