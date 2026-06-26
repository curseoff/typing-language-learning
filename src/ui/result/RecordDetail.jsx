// ランキングの1件をクリックしたときに表示する記録の結果ページ（全画面）。
// 速度系（速度）とクイズ系（正解数）の両対応。問題ごとの記録(segStats)があれば表示。
// ページ内のランキングをクリックすると他の記録に切り替わる。
import { useEffect, useState } from 'react'
import { modeLabel } from '../../content/modes.js'
import SegStatsTable from './SegStatsTable.jsx'
import { useReplay } from './ReplayContext.jsx'

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
  const onReplay = useReplay()
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
  // 「もう一度チャレンジ」を出せる記録か。seed があれば同じ問題列を再現でき、
  // 物語は決定的（固定ナラティブ）なので seed 無しでも同じ開始から再挑戦できる。
  const replayable = r.seed != null || r.source === 'story'

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

        {/* 物語の新記録のみ（旧記録・他モードには choices が無い＝後方互換） */}
        {r.choices?.length > 0 && (
          <div className="seg-stats story-choices">
            <h3>選んだ選択肢</h3>
            <ol className="choice-list">
              {r.choices.map((c, i) => (
                <li key={i}>
                  <span className="choice-ja">{c.ja}</span>
                  {c.en && <span className="choice-en">{c.en}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

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
          {/* リプレイ可能な記録だけ表示（旧記録＝seed無し・source無しには出さない＝後方互換） */}
          {onReplay && replayable && (
            <button
              className="btn-primary"
              onClick={() => onReplay(r)}
              title="この記録と同じ問題列で再挑戦"
            >
              もう一度チャレンジ
            </button>
          )}
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
