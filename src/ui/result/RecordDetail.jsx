// ランキングの1件をクリックしたときに出す記録詳細（モーダル）。
// 速度系（速度/打鍵/秒/ミス/正確率）とクイズ系（正解数）の両方に対応。
// 問題ごとの記録(segStats)が保存されていれば表示する（今後の記録のみ）。
import { useEffect } from 'react'
import { modeLabel } from '../../content/modes.js'
import SegStatsTable from './SegStatsTable.jsx'

export default function RecordDetail({ record, modeKey, rankText, position, onClose }) {
  useEffect(() => {
    // キャプチャ段階で処理し伝播を止める＝結果ページの「Escでトップへ」より先にモーダルを閉じる
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const isQuiz = record.correct != null

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
          <div className="result-speed">
            {isQuiz ? `${record.correct}/${record.words}` : record.speed}
          </div>
          <div className="result-unit">{isQuiz ? '正解' : '打/分'}</div>
        </div>
        <div className="result-sub">
          {!isQuiz && record.keys != null && <span>{record.keys} 打</span>}
          {record.seconds != null && <span>{record.seconds} 秒</span>}
          {record.mistakes != null && <span>ミス {record.mistakes}</span>}
          {record.accuracy != null && <span>正確率 {record.accuracy}%</span>}
          {record.endLabel && <span>エンド: {record.endLabel}</span>}
        </div>
        <div className="result-date">{record.date}</div>
        {record.segStats && <SegStatsTable segStats={record.segStats} />}
        <p className="key-hint">
          <kbd>Esc</kbd> で閉じる
        </p>
      </div>
    </div>
  )
}
