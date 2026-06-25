// 復習(SRS)画面。デッキの手がかり(prompt)を見て英単語(answer)をタイプ＝産出想起。
// 答えは伏せ、長さだけ下線で示す。
import { useReview } from '../../application/useReview.js'
import { clozeShown } from '../../domain/srs/srs.js'
import { StatsRow } from '../shared/index.js'

export default function ReviewView({ deck, items, onExit }) {
  const r = useReview({ deck, items, onExit })

  const meta = (
    <div className="play-meta">
      <span className="meta-badge rank">復習</span>
      <span className="meta-badge mode">{deck.label}</span>
    </div>
  )

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

  const { card, input, answered, wasOk, example } = r
  const target = card.answer
  // 習熟(box)に応じて一部の文字をヒント表示（穴埋め）。位置は id で決定的。
  const shown = clozeShown(target, card.box, card.id)

  return (
    <div className="game">
      {meta}
      <div className="word-card">
        <div className="word-dir">{deck.dir}（Tab=答えを見る / Esc=終了）</div>
        <p className="word-prompt">{card.prompt}</p>
        <div className="word-input">
          {answered ? (
            <span className={wasOk ? 'reveal-answer' : 'reveal-answer wrong'}>
              {wasOk ? '✓ ' : '✗ '}
              {target}
            </span>
          ) : (
            <>
              {[...target].map((ch, i) => {
                if (i < input.length) return <span key={i} className="rdone">{input[i]}</span>
                if (shown[i]) return <span key={i} className="hint-char">{ch}</span> // ヒント文字
                return <span key={i} className="blank">_</span>
              })}
              <span className="caret">▍</span>
            </>
          )}
        </div>
        {answered && example && (
          <div className="review-example">
            <p className="rex-en">{example.en}</p>
            <p className="rex-ja">{example.ja}</p>
          </div>
        )}
        {answered && <p className="hint">Enter で次へ</p>}
        {card.isNew && !answered && <p className="hint">新しい単語</p>}
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
