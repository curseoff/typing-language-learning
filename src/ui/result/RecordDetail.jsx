// ランキングの1件をクリックしたときに表示する記録の結果ページ（全画面）。
// 速度系（速度）とクイズ系（正解数）の両対応。問題ごとの記録(segStats)があれば表示。
// ページ内のランキングをクリックすると他の記録に切り替わる。
import { useEffect, useState } from 'react'
import { modeLabel } from '../../content/modes.js'
import SegStatsTable from './SegStatsTable.jsx'

export default function RecordDetail({
  list,
  initial,
  rankText,
  modeKey,
  isQuiz,
  hasEnding,
  onClose,
}) {
  const [cur, setCur] = useState(initial) // { record, position }
  useEffect(() => {
    // キャプチャ段階で処理し伝播を止める＝下のページの Esc ハンドラより先に閉じる
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

  const r = cur.record
  const quiz = r.correct != null

  return (
    <div className="record-page">
      <div className="record-page-inner result">
        <button className="modal-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
        <h2>記録</h2>
        <div className="result-mode">
          <span className="detail-rank">#{cur.position}</span>
          {rankText}
          {modeKey && <> ／ {modeLabel(modeKey)}</>}
        </div>
        <div className="result-main">
          <div className="result-speed">{quiz ? `${r.correct}/${r.words}` : r.speed}</div>
          <div className="result-unit">{quiz ? '正解' : '打/分'}</div>
        </div>
        <div className="result-sub">
          {!quiz && r.keys != null && <span>{r.keys} 打</span>}
          {r.seconds != null && <span>{r.seconds} 秒</span>}
          {r.mistakes != null && <span>ミス {r.mistakes}</span>}
          {r.accuracy != null && <span>正確率 {r.accuracy}%</span>}
          {r.endLabel && <span>エンド: {r.endLabel}</span>}
        </div>
        <div className="result-date">{r.date}</div>

        {r.segStats && <SegStatsTable segStats={r.segStats} />}

        <div className="records">
          <h3>
            記録ランキング
            {rankText && <span className="records-mode">{rankText}</span>}
          </h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{isQuiz ? '正解' : '速度'}</th>
                <th>正確率</th>
                <th>時間</th>
                {hasEnding && <th>エンド</th>}
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {list.map((rr, i) => (
                <tr
                  key={i}
                  className={`row-click ${rr.date === r.date ? 'me' : ''}`}
                  onClick={() => setCur({ record: rr, position: i + 1 })}
                  title="クリックでこの記録を表示"
                >
                  <td>{i + 1}</td>
                  <td className="speed">
                    {isQuiz ? `${rr.correct}/${rr.words}` : `${rr.speed} 打/分`}
                  </td>
                  <td>{rr.accuracy}%</td>
                  <td>{rr.seconds}秒</td>
                  {hasEnding && <td>{rr.endLabel}</td>}
                  <td className="date">{rr.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ending-actions">
          <button className="story-exit" onClick={onClose}>
            閉じる
          </button>
        </div>
        <p className="key-hint">
          <kbd>Esc</kbd> で閉じる
        </p>
      </div>
    </div>
  )
}
