// タッチタイピング練習の画面。打つべきキー・使う指・キーボードを表示。
import { useTouch } from '../../application/useTouch.js'
import { FINGER, FINGER_LABEL } from '../../content/keyboard.js'
import Keyboard from './Keyboard.jsx'

export default function TouchView({ level, levelLabel, onExit }) {
  const t = useTouch({ level, onExit })

  return (
    <div className="game">
      <div className="play-meta">
        <span className="meta-badge rank">タッチタイピング</span>
        <span className="meta-badge mode">{levelLabel}</span>
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
            {t.done.slice(-3).map((k, i) => (
              <span key={`d${i}`} className="strip-key done">
                {k.toUpperCase()}
              </span>
            ))}
            <span className={`strip-key current fg-${FINGER[t.target]} ${t.hasError ? 'err' : ''}`}>
              {t.target.toUpperCase()}
            </span>
            {t.upcoming.slice(0, 8 - Math.min(3, t.done.length)).map((k, i) => (
              <span key={`u${i}`} className="strip-key">
                {k.toUpperCase()}
              </span>
            ))}
          </div>

          <p className="touch-finger">使う指：{FINGER_LABEL[FINGER[t.target]]}</p>

          <Keyboard target={t.target} hasError={t.hasError} />

          <p className="hint">
            ハイライトされたキーを、対応する指で打ちます（画面を見ずに打てるように）。
            <kbd>Esc</kbd> で中断。
          </p>
        </>
      )}
    </div>
  )
}
