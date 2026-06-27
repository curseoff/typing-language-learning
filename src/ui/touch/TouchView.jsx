// タッチタイピング練習の画面。打つべきキー・使う指・キーボードを表示。
import { useEffect, useRef } from 'react'
import { useTouch } from '../../application/useTouch.js'
import { FINGER, FINGER_LABEL } from '../../content/keyboard.js'
import Keyboard from './Keyboard.jsx'

export default function TouchView({ level, levelLabel, mode, modeLabel, onRecord, onExit }) {
  const t = useTouch({ level, onExit })
  const showTarget = mode !== 'hard' // むずかしいは打つキーをハイライトしない

  // 完了時に記録を1回だけ保存（速い順ランキングに積む）。restart で再び保存できるようリセット。
  const saved = useRef(false)
  useEffect(() => {
    if (!t.finished) {
      saved.current = false
      return
    }
    if (saved.current) return
    saved.current = true
    const seconds = t.elapsedSec
    const speed = seconds > 0 ? Math.round((t.total / seconds) * 60) : 0
    const accuracy = Math.round((t.total / (t.total + t.mistakes)) * 100)
    onRecord?.({
      source: 'touch',
      mode,
      rank: level,
      speed,
      mistakes: t.mistakes,
      accuracy,
      seconds,
      date: new Date().toLocaleString('ja-JP'),
    })
    // 完了フラグ立ち上がりで保存。値は当該レンダーのものを使う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.finished])

  return (
    <div className="game">
      <div className="play-meta">
        <span className="meta-badge rank">タッチタイピング</span>
        <span className="meta-badge mode">{levelLabel}</span>
        {modeLabel ? <span className="meta-badge mode">{modeLabel}</span> : null}
      </div>

      {t.finished ? (
        <div className="result">
          <h2>完了！</h2>
          <div className="result-sub">
            <span>{t.total} 打</span>
            <span>ミス {t.mistakes}</span>
            <span>{t.elapsedSec} 秒</span>
          </div>
          <div className="ending-actions">
            <button className="btn-primary" onClick={t.restart}>
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
          <div className="touch-bar">
            <span>
              打鍵 {t.index} / {t.total}
            </span>
            <span>ミス {t.mistakes}</span>
            <span>{t.elapsedSec} 秒</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(t.index / t.total) * 100}%` }} />
          </div>

          <div className="touch-strip">
            <div
              className="strip-track"
              style={{ transform: `translateX(${-Math.max(0, t.index - 3) * 42}px)` }}
            >
              {t.targets.map((k, i) => {
                const cur = i === t.index
                const cls =
                  'strip-key' + (i < t.index ? ' done' : '') + (cur ? ` current fg-${FINGER[k]}` : '')
                return (
                  <span key={i} className={cls}>
                    {k.toUpperCase()}
                  </span>
                )
              })}
            </div>
          </div>

          <p className="touch-finger">使う指：{FINGER_LABEL[FINGER[t.target]]}</p>

          <Keyboard
            target={t.target}
            hasError={t.hasError}
            showTarget={showTarget}
            wrongKey={t.wrongKey}
            pressed={t.pressed}
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
