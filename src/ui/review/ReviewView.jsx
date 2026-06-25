// 復習(SRS)画面。和訳を見て英単語をタイプ＝産出想起。答えは伏せ、長さだけ下線で示す。
import { useReview } from '../../application/useReview.js'
import { StatsRow } from '../shared/index.js'

export default function ReviewView({ words, onExit }) {
  const r = useReview({ words, onExit })

  const meta = (
    <div className="play-meta">
      <span className="meta-badge rank">復習</span>
      <span className="meta-badge mode">間隔反復</span>
    </div>
  )

  // 今日の対象が無い
  if (r.total === 0) {
    return (
      <div className="game">
        {meta}
        <div className="word-card">
          <p className="word-prompt">今日の復習はありません 🎉</p>
          <p className="hint">新しい単語を学ぶか、また明日どうぞ。</p>
        </div>
        <button className="btn-primary" onClick={onExit}>
          トップへ戻る
        </button>
      </div>
    )
  }

  // 終了
  if (r.finished) {
    return (
      <div className="game">
        {meta}
        <p className="result-main">
          <span className="result-speed">{r.correct}</span>
          <span className="result-unit"> / {r.total} 正解</span>
        </p>
        <p className="result-sub">お疲れさまでした。間隔をあけて、また復習しましょう。</p>
        <button className="btn-primary" onClick={onExit}>
          トップへ戻る
        </button>
      </div>
    )
  }

  const { card, input, revealed, target } = { ...r, target: r.card?.en ?? '' }

  return (
    <div className="game">
      {meta}
      <div className="word-card">
        <div className="word-dir">意味に合う英単語を入力（Tab=答えを見る / Esc=終了）</div>
        <p className="word-prompt">{card.ja}</p>
        <div className={`word-input ${r.mistakes > 0 && !revealed ? '' : ''}`}>
          {revealed ? (
            <span className="reveal-answer">{target}</span>
          ) : (
            <>
              {[...target].map((ch, i) => (
                <span key={i} className={i < input.length ? 'rdone' : 'blank'}>
                  {i < input.length ? input[i] : '_'}
                </span>
              ))}
              <span className="caret">▍</span>
            </>
          )}
        </div>
        {revealed && <p className="hint">Enter で次へ</p>}
        {card.isNew && !revealed && <p className="hint">新しい単語</p>}
      </div>

      <StatsRow
        stats={[
          { label: '進捗', value: `${r.index} / ${r.total}` },
          { label: '正解', value: r.correct },
          { label: 'ミス', value: r.mistakes },
        ]}
        progress={r.total ? r.index / r.total : 0}
      />
    </div>
  )
}
