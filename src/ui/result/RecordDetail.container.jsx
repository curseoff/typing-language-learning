// ランキングの1件をクリックしたときに表示する記録の結果ページ（全画面）。
// 速度系（速度）とクイズ系（正解数）の両対応。問題ごとの記録(segStats)があれば表示。
// ページ内のランキングをクリックすると他の記録に切り替わる。
import { useEffect, useRef, useState } from 'react'
import { modeLabel } from '../../content/modes.js'
import { deleteRecordAt, getPersistRole } from '../../application/records.service.js'
import SegStatsTable from './SegStatsTable.presenter.jsx'
import { useReplay } from './ReplayContext.context.jsx'

export default function RecordDetail({
  list,
  initial,
  rankText,
  modeKey,
  hasEnding,
  onClose,
  onDeleted,
}) {
  const [cur, setCur] = useState(initial) // { record, position }
  // 削除の 2 段階確認。'idle'→'confirm'→（実行）。'failed' は position ずれ等で消せなかった状態。
  // window.confirm はブロッキングモーダルで PWA の体験を壊すので使わず、ボタン自身を確認状態に変える。
  const [delState, setDelState] = useState('idle')
  const onReplay = useReplay()
  // 副タブ（secondary）は読み取り専用で、消しても主タブの次の snapshot で復活する。
  // 「消したのに戻る」が最悪の体験なので、そもそもボタンを出さない。
  const canDelete = getPersistRole() !== 'secondary'
  const cancelRef = useRef(null)
  // 確認状態に切り替わると idle の「削除」が unmount され、フォーカスが body へ落ちて
  // キーボード/スクリーンリーダー利用者が押下位置を見失う。安全側の「やめる」へ移す
  // （危険な「本当に削除する」に置くと、そのまま Enter/Space で確定してしまう）。
  useEffect(() => {
    if (delState === 'confirm') cancelRef.current?.focus()
  }, [delState])
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
  // 物語(story)以外は全モードでタイピング数(keys)を主指標にする（60秒固定）。
  const isStory = hasEnding || r.source === 'story'
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
          <div className="result-speed">{isStory ? r.speed : (r.keys ?? 0)}</div>
          <div className="result-unit">{isStory ? '打/分' : 'タイピング数'}</div>
        </div>
        <div className="result-sub">
          {!isStory && r.speed != null && <span>速度 {r.speed} 打/分</span>}
          {quiz && r.correct != null && <span>正解 {r.correct}/{r.words}</span>}
          {r.mistakes != null && <span>ミス {r.mistakes}</span>}
          {r.accuracy != null && <span>正確率 {r.accuracy}%</span>}
          {r.seconds != null && <span>{r.seconds} 秒</span>}
          {r.endLabel && <span>エンド: {r.endLabel}</span>}
        </div>
        <div className="result-date">{r.date}</div>

        {/* 場面（segStats）と、その場面で選んだ選択肢（choices）を時系列で統合表示。
            choices は物語の新記録のみ持つ（旧記録・他モードは無し＝後方互換）。 */}
        {r.segStats && <SegStatsTable segStats={r.segStats} choices={r.choices} />}

        <div className="records">
          <h3>
            記録ランキング
            {rankText && <span className="records-mode">{rankText}</span>}
          </h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{isStory ? '速度' : 'タイピング数'}</th>
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
                  onClick={() => {
                    setCur({ record: rr, position: i + 1 })
                    // 確認状態のまま別の記録に切り替わると「次の 1 クリックで別物が消える」ので必ず戻す
                    setDelState('idle')
                  }}
                  title="クリックでこの記録を表示"
                >
                  <td>{i + 1}</td>
                  <td className="speed">
                    {isStory ? `${rr.speed} 打/分` : (rr.keys ?? 0)}
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
          {/* 狭幅では削除系を独立行へ落とすための改行子（flex の 100% ベーシス）。
              並びが [閉じる][削除] のまま折り返すと押し間違えやすいので物理的に行を分ける。 */}
          {canDelete && <span className="ending-actions__break" aria-hidden="true" />}
          {/* 削除は 2 段階：1 回目は確認へ切り替えるだけで、実際に消すのは 2 回目のクリック */}
          {canDelete && delState !== 'confirm' && (
            <button
              className="record-delete"
              onClick={() => setDelState('confirm')}
              aria-label="この記録を削除する"
            >
              削除
            </button>
          )}
          {canDelete && delState === 'confirm' && (
            <>
              {/* 「やめる」を先に置き、元の「削除」と同じ位置に来るようにする。
                  1 クリック目の直下に確認ボタンが現れると、連打・ダブルクリックで
                  読む間もなく確定してしまうため、誤射は安全側（取り消し）に落とす。 */}
              <button
                className="story-exit"
                ref={cancelRef}
                onClick={() => setDelState('idle')}
              >
                やめる
              </button>
              <button
                className="record-delete record-delete--confirm"
                onClick={() => {
                  if (deleteRecordAt(cur.record, cur.position)) {
                    // 一覧を読み直す責務は呼び出し側（App）に委ねる。無ければ閉じるだけ。
                    if (onDeleted) onDeleted()
                    else onClose()
                  } else setDelState('failed') // 消えなかったことが分かる表示にして閉じない
                }}
                aria-label="本当に削除する"
              >
                本当に削除する
              </button>
            </>
          )}
        </div>
        {/* 確認・失敗の状態変化をスクリーンリーダーにも伝える。
            削除できない画面（副タブ）では文言が出ることが無いので、高さ確保の余白ごと描かない。 */}
        {canDelete && (
          <p className="record-delete-note" role="status" aria-live="polite">
            {delState === 'confirm' && 'この記録を削除します。取り消せません。'}
            {delState === 'failed' && '削除できませんでした。一覧を開き直してからもう一度お試しください。'}
          </p>
        )}
        <p className="key-hint">
          <kbd>Esc</kbd> で閉じる
        </p>
      </div>
    </div>
  )
}
