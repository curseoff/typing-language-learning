// マラソン/物語モードで共有する表示部品（純粋なプレゼンテーション）。

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

// ステータス4枚＋進捗バー。stats=[{label,value}], progress=0..1
export function StatsRow({ stats, progress }) {
  return (
    <>
      <div className="stats">
        {stats.map((s, i) => (
          <Stat key={i} label={s.label} value={s.value} />
        ))}
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(1, progress) * 100}%` }} />
      </div>
    </>
  )
}

// 打鍵の色分け（.ch: done/current/error/over、カーソルあり）。主要な入力エリア用。
export function Chars({ text, done, cursor = -1, hasError = false, over = false }) {
  return [...text].map((ch, i) => {
    let cls = 'ch'
    if (i < done) cls += ' done'
    else if (i === cursor) cls += hasError ? ' cur err' : ' cur'
    if (over) cls += ' over'
    return (
      <span key={i} className={cls}>
        {ch}
      </span>
    )
  })
}

// 打った分だけ緑（.rdone、カーソルなし）。フロー参照表示用。
export function Typed({ text, done }) {
  return [...text].map((ch, i) => (
    <span key={i} className={i < done ? 'rdone' : ''}>
      {ch}
    </span>
  ))
}

// 翻訳モードの伏せ字（打った分だけ現れる）
export function MaskedText({ text, pos, hasError }) {
  return [...text].map((ch, i) => {
    const typed = i < pos
    const isCursor = i === pos
    let cls = 'mch'
    let disp
    if (typed) {
      cls += ' typed'
      disp = ch
    } else {
      cls += isCursor ? (hasError ? ' mcur err' : ' mcur') : ' hidden'
      disp = ch === ' ' ? ' ' : '·'
    }
    return (
      <span key={i} className={cls}>
        {disp}
      </span>
    )
  })
}

// 単語チップ（語順index < used を消費表示）。chips=[{text,i}]
export function Chips({ chips, used }) {
  return (
    <div className="tr-chips">
      {chips.map((c) => (
        <span key={c.i} className={`chip ${c.i < used ? 'used' : ''}`}>
          {c.text}
        </span>
      ))}
    </div>
  )
}
