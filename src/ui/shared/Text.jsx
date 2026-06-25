// 文字描画の共有部品（純粋なプレゼンテーション）。
import { Fragment } from 'react'
import { rubyParts } from '../../domain/typing/progress.js'

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

// 漢字runに <ruby> でふりがなを付けつつ、Chars と同じ打鍵色分けをする。
export function RubyChars({ ja, kana, done, cursor = -1, hasError = false, over = false }) {
  const charSpan = (ch, gi) => {
    let cls = 'ch'
    if (gi < done) cls += ' done'
    else if (gi === cursor) cls += hasError ? ' cur err' : ' cur'
    if (over) cls += ' over'
    return (
      <span key={gi} className={cls}>
        {ch}
      </span>
    )
  }
  return rubyParts(ja, kana).map((p, pi) =>
    p.ruby ? (
      <ruby key={pi}>
        {p.chars.map((ch, j) => charSpan(ch, p.from + j))}
        <rt>{p.ruby}</rt>
      </ruby>
    ) : (
      <Fragment key={pi}>{p.chars.map((ch, j) => charSpan(ch, p.from + j))}</Fragment>
    ),
  )
}

// フロー参照表示用：打った分だけ緑（.rdone）＋漢字にふりがな。
// done=漢字(ja文字)の打鍵済み数 / kanaDone=読み(かな)の打鍵済み数。
// ふりがな(rt)は「かな単位」で着色するので、太陽(たいよう)で「た」を打つと「た」だけ色が変わる。
// hasError時は今打つ文字(漢字=done位置 / ふりがな=kanaDone位置)を赤(.rerr)にする。
export function RubyTyped({ ja, kana, done, kanaDone = 0, hasError = false }) {
  const cellCls = (i, end) => (i < end ? 'rdone' : i === end && hasError ? 'rerr' : '')
  const charSpan = (ch, gi) => (
    <span key={gi} className={cellCls(gi, done)}>
      {ch}
    </span>
  )
  return rubyParts(ja, kana).map((p, pi) =>
    p.ruby ? (
      <ruby key={pi}>
        {p.chars.map((ch, j) => charSpan(ch, p.from + j))}
        <rt>
          {[...p.ruby].map((rc, j) => (
            <span key={j} className={cellCls(p.kanaFrom + j, kanaDone)}>
              {rc}
            </span>
          ))}
        </rt>
      </ruby>
    ) : (
      <Fragment key={pi}>{p.chars.map((ch, j) => charSpan(ch, p.from + j))}</Fragment>
    ),
  )
}

// 色分けなしの素のルビ表示（先読み・参考表示用）。
export function RubyText({ ja, kana }) {
  return rubyParts(ja, kana).map((p, pi) =>
    p.ruby ? (
      <ruby key={pi}>
        {p.chars.join('')}
        <rt>{p.ruby}</rt>
      </ruby>
    ) : (
      <Fragment key={pi}>{p.chars.join('')}</Fragment>
    ),
  )
}

// 打った分だけ緑（.rdone）。間違えた時は今打つ文字(done位置)を赤(.rerr)に。
export function Typed({ text, done, hasError = false }) {
  return [...text].map((ch, i) => {
    let cls = ''
    if (i < done) cls = 'rdone'
    else if (i === done && hasError) cls = 'rerr'
    return (
      <span key={i} className={cls}>
        {ch}
      </span>
    )
  })
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
