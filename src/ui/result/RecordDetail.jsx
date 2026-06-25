// ランキングの1件をクリックしたときに出す記録詳細（モーダル）。
// 速度系の記録（速度/打鍵/秒/ミス/正確率/日時）を結果ページ風に表示する。
// ※ 問題ごとの記録(segStats)はランキングには保存されないため表示しない。
import { useEffect } from 'react'
import { modeLabel } from '../../content/modes.js'

export default function RecordDetail({ record, modeKey, rankText, position, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card result" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
        <h2>記録の詳細</h2>
        <div className="result-mode">
          {position != null && <span className="detail-rank">#{position}</span>}
          {rankText}
          {modeKey && <> ／ {modeLabel(modeKey)}</>}
        </div>
        <div className="result-main">
          <div className="result-speed">{record.speed}</div>
          <div className="result-unit">打/分</div>
        </div>
        <div className="result-sub">
          {record.keys != null && <span>{record.keys} 打</span>}
          <span>{record.seconds} 秒</span>
          {record.mistakes != null && <span>ミス {record.mistakes}</span>}
          <span>正確率 {record.accuracy}%</span>
        </div>
        <div className="result-date">{record.date}</div>
        <p className="key-hint">
          <kbd>Esc</kbd> で閉じる
        </p>
      </div>
    </div>
  )
}
