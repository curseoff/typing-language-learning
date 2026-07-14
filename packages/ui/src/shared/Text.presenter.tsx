// 文字描画の共有部品（純粋なプレゼンテーション）。
import { Fragment } from 'react'
import { rubyParts } from '@tll/core'

export interface CharsProps {
  text: string
  done: number
  cursor?: number
  hasError?: boolean
  over?: boolean
}

// 打鍵の色分け（.ch: done/current/error/over、カーソルあり）。主要な入力エリア用。
export function Chars({ text, done, cursor = -1, hasError = false, over = false }: CharsProps) {
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

export interface RubyCharsProps {
  ja: string
  kana: string
  done: number
  cursor?: number
  hasError?: boolean
  over?: boolean
  kanaDone?: number | null
}

// 漢字runに <ruby> でふりがなを付けつつ、Chars と同じ打鍵色分けをする。
// kanaDone を渡すと、ふりがな(rt)も「入力済みのかな」を done 色（緑）にする（未指定なら素のまま＝従来挙動）。
export function RubyChars({
  ja,
  kana,
  done,
  cursor = -1,
  hasError = false,
  over = false,
  kanaDone = null,
}: RubyCharsProps) {
  const charSpan = (ch: string, gi: number) => {
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
  const rt = (p: { ruby: string; kanaFrom: number }) =>
    kanaDone == null
      ? p.ruby
      : [...p.ruby].map((rc, j) => (
          <span key={j} className={p.kanaFrom + j < kanaDone ? 'ch done' : 'ch'}>
            {rc}
          </span>
        ))
  return rubyParts(ja, kana).map((p, pi) =>
    p.ruby ? (
      <ruby key={pi}>
        {p.chars.map((ch, j) => charSpan(ch, p.from + j))}
        <rt>{rt(p)}</rt>
      </ruby>
    ) : (
      <Fragment key={pi}>{p.chars.map((ch, j) => charSpan(ch, p.from + j))}</Fragment>
    ),
  )
}

export interface RubyTypedProps {
  ja: string
  kana: string
  done: number
  kanaDone?: number
  hasError?: boolean
}

// フロー参照表示用：打った分だけ緑（.rdone）＋漢字にふりがな。
// done=漢字(ja文字)の打鍵済み数 / kanaDone=読み(かな)の打鍵済み数。
// ふりがな(rt)は「かな単位」で着色するので、太陽(たいよう)で「た」を打つと「た」だけ色が変わる。
// hasError時は今打つ文字(漢字=done位置 / ふりがな=kanaDone位置)を赤(.rerr)にする。
export function RubyTyped({ ja, kana, done, kanaDone = 0, hasError = false }: RubyTypedProps) {
  const cellCls = (i: number, end: number) =>
    i < end ? 'rdone' : i === end && hasError ? 'rerr' : ''
  // 本体文字(漢字・かな)は基底クラス rch を付けて per-char 下線の対象にする。
  // ふりがな(rt)は文字の上にあり下線と干渉するため rch を付けない（色分けのみ）。
  const bodyCls = (i: number, end: number) => `rch ${cellCls(i, end)}`.trimEnd()
  const charSpan = (ch: string, gi: number) => (
    <span key={gi} className={bodyCls(gi, done)}>
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

export interface RubyTextProps {
  ja: string
  kana: string
}

// 色分けなしの素のルビ表示（先読み・参考表示用）。
export function RubyText({ ja, kana }: RubyTextProps) {
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

export interface MaskedRubyTextProps {
  ja: string
  kana?: string
  maskCh?: string
}

// RubyText と同じ segmentation のまま各文字を全角マスク（＊）で伏せる。
// 回答前の和訳スロットで「実物と同じ行数・幅」を占めて高さを予約するための表示。
// 全角マスクなので漢字/かなと同じ字幅になり折返しが実物と一致し、rt(ルビ)行も保つ。
export function MaskedRubyText({ ja, kana, maskCh = '＊' }: MaskedRubyTextProps) {
  const mask = (s: string) => maskCh.repeat([...s].length)
  if (!ja) return null
  if (!kana) return mask(ja)
  return rubyParts(ja, kana).map((p, pi) =>
    p.ruby ? (
      <ruby key={pi}>
        {mask(p.chars.join(''))}
        <rt>{mask(p.ruby)}</rt>
      </ruby>
    ) : (
      <Fragment key={pi}>{mask(p.chars.join(''))}</Fragment>
    ),
  )
}

export interface TypedProps {
  text: string
  done: number
  hasError?: boolean
}

// 打った分だけ緑（.rdone）。間違えた時は今打つ文字(done位置)を赤(.rerr)に。
export function Typed({ text, done, hasError = false }: TypedProps) {
  // 基底クラス rch を全 span に付け、per-char 下線(.typing 配下でのみ表示)の対象にする。
  return [...text].map((ch, i) => {
    let cls = 'rch'
    if (i < done) cls += ' rdone'
    else if (i === done && hasError) cls += ' rerr'
    return (
      <span key={i} className={cls}>
        {ch}
      </span>
    )
  })
}

export interface MaskedTextProps {
  text: string
  pos: number
  hasError?: boolean
}

// 翻訳モードの伏せ字（打った分だけ現れる）
export function MaskedText({ text, pos, hasError }: MaskedTextProps) {
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

export interface MaskedRubyProps {
  ja: string
  kana: string
  done: number
  kanaDone?: number
  hasError?: boolean
}

// ルビ付きの伏せ字（#402 穴埋めをフロー内で in-place 表示）。MaskedText と同じ mch 体裁で、
// 本体(漢字/かな)は done 位置までを現し、ふりがな(rt)は kanaDone 位置までを現す。
// done=0/kanaDone=0 なら全て伏字（future 語向け）。hasError で今打つ本体文字をカーソル赤に。
export function MaskedRuby({ ja, kana, done, kanaDone = 0, hasError = false }: MaskedRubyProps) {
  const bodyChar = (ch: string, gi: number) => {
    const typed = gi < done
    const isCursor = gi === done
    let cls = 'mch'
    let disp: string
    if (typed) {
      cls += ' typed'
      disp = ch
    } else {
      cls += isCursor ? (hasError ? ' mcur err' : ' mcur') : ' hidden'
      disp = ch === ' ' ? ' ' : '·'
    }
    return (
      <span key={gi} className={cls}>
        {disp}
      </span>
    )
  }
  const rtChar = (rc: string, ki: number) => {
    const typed = ki < kanaDone
    return (
      <span key={ki} className={`mch ${typed ? 'typed' : 'hidden'}`}>
        {typed ? rc : '·'}
      </span>
    )
  }
  return rubyParts(ja, kana).map((p, pi) =>
    p.ruby ? (
      <ruby key={pi}>
        {p.chars.map((ch, j) => bodyChar(ch, p.from + j))}
        <rt>{[...p.ruby].map((rc, j) => rtChar(rc, p.kanaFrom + j))}</rt>
      </ruby>
    ) : (
      <Fragment key={pi}>{p.chars.map((ch, j) => bodyChar(ch, p.from + j))}</Fragment>
    ),
  )
}

export interface Chip {
  text: string
  i: number
  kana?: string
}

export interface ChipsProps {
  chips: Chip[]
  used: number
  curDone?: number
  curKanaDone?: number
  hasError?: boolean
}

// 単語チップ（語順index < used を消費表示）。chips=[{text,i}]
// used=打ち終えた語数。今打っている語の頭文字を正しく打ってから(=curDone/curKanaDone>0)
// 強調＋着色する。打つ前は正解チップを見せない。間違えたら赤。
export function Chips({ chips, used, curDone = 0, curKanaDone = 0, hasError = false }: ChipsProps) {
  const matchedCur = curDone > 0 || curKanaDone > 0 // 頭文字がマッチしたか
  return (
    <div className="tr-chips">
      {chips.map((c) => {
        const isCur = c.i === used && matchedCur
        const cls = `chip ${c.i < used ? 'used' : ''} ${isCur ? 'current' : ''}`
        return (
          <span key={c.i} className={cls}>
            {c.kana ? (
              isCur ? (
                <RubyTyped
                  ja={c.text}
                  kana={c.kana}
                  done={curDone}
                  kanaDone={curKanaDone}
                  hasError={hasError}
                />
              ) : (
                <RubyText ja={c.text} kana={c.kana} />
              )
            ) : isCur ? (
              <Typed text={c.text} done={curDone} hasError={hasError} />
            ) : (
              c.text
            )}
          </span>
        )
      })}
    </div>
  )
}
