// マラソン/物語モードで共有する表示部品（純粋なプレゼンテーション）。
import { useEffect, useRef } from 'react'

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

// 英語/日本語の二段フロー（1行ぶん）。scrollToCenter で現在文を中央へ寄せる。
function FlowRow({ tag, tagClass, items, cur, active, scrollToCenter, render }) {
  const trackRef = useRef(null)
  const curRef = useRef(null)
  useEffect(() => {
    if (!scrollToCenter) return
    const track = trackRef.current
    const el = curRef.current
    if (!track || !el) return
    const left = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2
    track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [cur, scrollToCenter])
  return (
    <div className="flow-row">
      <span className={`ref-tag ${tagClass}`}>{tag}</span>
      <div className="flow-track" ref={trackRef}>
        {items.map((it, k) => (
          <span
            key={k}
            ref={k === cur ? curRef : null}
            className={`flow-item ${k === cur ? 'current' : k < cur ? 'past' : 'future'} ${
              k === cur && active ? 'typing' : ''
            }`}
          >
            {render(it, k === cur)}
          </span>
        ))}
      </div>
    </div>
  )
}

// 英語/日本語の二段フロー（マラソン=中央スクロール / 物語=左寄せ）。
// items=[{en,ja}], cur=現在index, enDone/jaDone=現在文の進捗, activeRow='en'|'ja'|null
export function Flow({
  items,
  cur,
  enDone,
  jaDone,
  activeRow,
  showEn = true,
  showJa = true,
  scrollToCenter = false,
}) {
  return (
    <div className="flow">
      {showEn && (
        <FlowRow
          tag="英語"
          tagClass="en"
          items={items}
          cur={cur}
          active={activeRow === 'en'}
          scrollToCenter={scrollToCenter}
          render={(it, isCur) => (isCur ? <Typed text={it.en} done={enDone} /> : it.en)}
        />
      )}
      {showJa && (
        <FlowRow
          tag="日本語"
          tagClass="ja"
          items={items}
          cur={cur}
          active={activeRow === 'ja'}
          scrollToCenter={scrollToCenter}
          render={(it, isCur) => (
            <span className="flow-ja">{isCur ? <Typed text={it.ja} done={jaDone} /> : it.ja}</span>
          )}
        />
      )}
    </div>
  )
}
