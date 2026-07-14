// 英語/日本語のフロー表示。
// - 通常(wrap): 現在文＋先読みを折り返し（長文の例文・物語向け）。
// - ticker: 入力位置を一定に保ち1文字ごとに左スクロール（単語モード向け）。
// - ticker かつ both（英語・日本語）: 英語と和訳を「ペア」で交互に並べる。
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Typed, RubyTyped, RubyText } from './Text.presenter'
import { tickerMaskImage } from './tickerMask.util'

export interface FlowItem {
  en: string
  ja: string
  kana?: string
  sentenceIndex?: number
}

const ANCHOR_RATIO = 0.35 // PairFlow(both) 用：入力位置を画面のこの割合に保つ
const CURSOR_MARGIN = 24 // 末尾カーソルを右端からこの px 内に必ず見せる（末尾優先クランプ用）
// 乗り換え(文A→B)の大移動を「距離比例の一定速度アニメ」にするためのパラメータ（#394）。
// 固定 duration だと1文ぶんの大移動が一瞬＝ワープに見える。移動距離÷速度で時間を決め等速グライドにする。
const GLIDE_VELOCITY = 850 // px/s（乗換が速すぎずワープに見えない速さ・実機微調整前提）
const GLIDE_MIN_DUR = 0.06 // s（打鍵中の小移動は短く即応）
const GLIDE_MAX_DUR = 0.35 // s（大きい乗換でも間延びしすぎない上限）

// PairFlow(both モード)用：入力位置(offsetLeft + 幅×frac)を ANCHOR に保つよう transform を ref で直接更新（1文字ごと左スクロール）。
// あわせて右端フェードを「語境界」にスナップし、収まる語はくっきり／はみ出す語だけをゴースト化する（#108）。
function useTickerScroll(frac: number, cur: number, len: number) {
  const trackRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const curRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const strip = stripRef.current
    const word = curRef.current
    const track = trackRef.current
    if (!strip || !word || !track) return
    const anchor = track.clientWidth * ANCHOR_RATIO
    const cursorX = word.offsetLeft + word.offsetWidth * frac
    const shift = Math.min(0, anchor - cursorX)
    strip.style.transform = `translateX(${shift}px)`
    // 各語のビュー座標(offsetLeft+shift)から右端フェードの開始位置を語境界へ合わせる。
    const boxes = Array.from(strip.children).map((c) => ({
      left: (c as HTMLElement).offsetLeft + shift,
      width: (c as HTMLElement).offsetWidth,
    }))
    const mask = tickerMaskImage(boxes, track.clientWidth, { curIndex: cur })
    track.style.maskImage = mask
    // webkitMaskImage は Safari 向けのベンダ接頭辞（型定義に無いこともあるので index 経由で設定）
    track.style.setProperty('-webkit-mask-image', mask)
  }, [frac, cur, len])
  return { trackRef, stripRef, curRef }
}

// 単一言語モードの1行ぶんのスクロール ref 束。親(Flow)が計測・transform を一括で行うため、
// 各 FlowRow は DOM に ref を張るだけで、送り量の決定は親の useSingleLangTicker が担う。
interface RowScroll {
  trackRef: RefObject<HTMLDivElement | null>
  stripRef: RefObject<HTMLDivElement | null>
  curRef: RefObject<HTMLSpanElement | null>
}

interface RowMeasure {
  strip: HTMLDivElement
  track: HTMLDivElement
  off: number // 現在文(現在語)の offsetLeft
  width: number // 現在文の offsetWidth
  tw: number // track の可視幅
}

function measureRow(r: RowScroll): RowMeasure | null {
  const strip = r.stripRef.current
  const word = r.curRef.current
  const track = r.trackRef.current
  if (!strip || !word || !track) return null
  return { strip, track, off: word.offsetLeft, width: word.offsetWidth, tw: track.clientWidth }
}

// 決まった shift を strip へ適用し、右端フェード(語境界スナップ)を再計算する。
// prevRef に前回 shift を保持し、移動距離に比例した transition-duration（等速グライド）を毎回設定する。
// transition-property/timing-function は CSS(.flow-strip: transform linear)のまま、duration だけ inline で上書き。
function applyRow(m: RowMeasure, shift: number, cur: number, prevRef: { current: number | null }) {
  const prev = prevRef.current
  // 初回(prev=null)は 0s で即置（translateX 未設定からのアニメを避ける）。以降は距離÷速度でクランプ。
  const dur =
    prev == null
      ? 0
      : Math.min(GLIDE_MAX_DUR, Math.max(GLIDE_MIN_DUR, Math.abs(shift - prev) / GLIDE_VELOCITY))
  prevRef.current = shift
  m.strip.style.transitionDuration = `${dur}s`
  m.strip.style.transform = `translateX(${shift}px)`
  const boxes = Array.from(m.strip.children).map((c) => ({
    left: (c as HTMLElement).offsetLeft + shift,
    width: (c as HTMLElement).offsetWidth,
  }))
  const mask = tickerMaskImage(boxes, m.tw, { curIndex: cur })
  m.track.style.maskImage = mask
  // webkitMaskImage は Safari 向けのベンダ接頭辞（型定義に無いこともあるので index 経由で設定）
  m.track.style.setProperty('-webkit-mask-image', mask)
}

// 単一言語モード(FlowRow×2)の左スクロールを2行まとめて同期する（#394）。
// - 現在文の先頭を左端(x=0)にピン留め（shiftPin = −offsetLeft）＝開始時の左空白なし・収まる文は左端固定で全文表示。
// - カーソル(off + width*cursorFrac)が右端手前(tw − margin)を越える長文だけ、末尾優先で左送り
//   （shiftCursor = (tw − margin) − (off + width*cursorFrac)）。shift = min(shiftPin, shiftCursor)＝より左を採用。
// - 英日同期：アクティブ行の実効先頭 x(= off_active + shift_active)を参考行にも共有（両行 abs スクリーン x 一致）。日本語入力時は対称。
// - 乗り換えの大移動は applyRow が距離比例の等速グライド duration で滑らせる（ワープ回避）。
function useSingleLangTicker(activeRow: 'en' | 'ja' | null, cursorFrac: number, cur: number, len: number) {
  const en: RowScroll = {
    trackRef: useRef<HTMLDivElement>(null),
    stripRef: useRef<HTMLDivElement>(null),
    curRef: useRef<HTMLSpanElement>(null),
  }
  const ja: RowScroll = {
    trackRef: useRef<HTMLDivElement>(null),
    stripRef: useRef<HTMLDivElement>(null),
    curRef: useRef<HTMLSpanElement>(null),
  }
  const enPrev = useRef<number | null>(null) // 前回 shift（グライド duration 計算用）
  const jaPrev = useRef<number | null>(null)
  useLayoutEffect(() => {
    const mEn = measureRow(en)
    const mJa = measureRow(ja)
    const any = mEn ?? mJa
    if (!any) return // ticker 以外(wrap)や計測前は strip 未描画で何もしない
    const active = activeRow === 'en' ? mEn : activeRow === 'ja' ? mJa : null
    // 左端ピン ＋ 末尾優先カーソルクランプ。より左（より負）の shift を採用。
    let effStartX = 0 // 実効の文頭 view-x（両行で共有）＝既定は左端(0)ピン
    if (active) {
      const shiftPin = -active.off // 現在文の先頭を x=0 へ
      const shiftCursor = active.tw - CURSOR_MARGIN - (active.off + active.width * cursorFrac)
      const shift = Math.min(shiftPin, shiftCursor)
      effStartX = shift + active.off
    }
    if (mEn) applyRow(mEn, effStartX - mEn.off, cur, enPrev)
    if (mJa) applyRow(mJa, effStartX - mJa.off, cur, jaPrev)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref 束(en/ja/prev)は不変。計測トリガは cursorFrac/cur/len で十分。
  }, [activeRow, cursorFrac, cur, len])
  return { en, ja }
}

interface FlowRowProps {
  tag: string
  tagClass: string
  items: FlowItem[]
  cur: number
  active: boolean
  render: (it: FlowItem, isCur: boolean) => ReactNode
  ticker: boolean
  scroll: RowScroll
}

// 1行ぶん。現在文を明るく＋進捗、先の文は薄く。ticker=true で1文字ごとの左スクロール（送り量は親が同期）。
function FlowRow({ tag, tagClass, items, cur, active, render, ticker, scroll }: FlowRowProps) {
  const { trackRef, stripRef, curRef } = scroll
  const cells = items.map((it, k) => (
    <span
      key={it.sentenceIndex ?? k}
      ref={k === cur ? curRef : null}
      className={`flow-item ${k === cur ? 'current' : k < cur ? 'past' : 'future'} ${
        k === cur && active ? 'typing' : ''
      }`}
    >
      {render(it, k === cur)}
    </span>
  ))
  return (
    <div className="flow-row">
      <span className={`ref-tag ${tagClass}`}>{tag}</span>
      <div className="flow-track" ref={trackRef}>
        {ticker ? (
          <div className="flow-strip" ref={stripRef}>
            {cells}
          </div>
        ) : (
          cells
        )}
      </div>
    </div>
  )
}

interface PairFlowProps {
  items: FlowItem[]
  cur: number
  enDone: number
  jaDone: number
  jaKanaDone: number
  hasError: boolean
  activeRow: 'en' | 'ja' | null
  frac: number
}

// both(英語・日本語)用：英語と和訳を1つの「ペア」にまとめ、横一列に交互に並べる。
function PairFlow({ items, cur, enDone, jaDone, jaKanaDone, hasError, activeRow, frac }: PairFlowProps) {
  const { trackRef, stripRef, curRef } = useTickerScroll(frac, cur, items.length)
  const renderJa = (it: FlowItem, isCur: boolean) =>
    it.kana ? (
      isCur ? (
        <RubyTyped
          ja={it.ja}
          kana={it.kana}
          done={jaDone}
          kanaDone={jaKanaDone}
          hasError={activeRow === 'ja' && hasError}
        />
      ) : (
        <RubyText ja={it.ja} kana={it.kana} />
      )
    ) : isCur ? (
      <Typed text={it.ja} done={jaDone} hasError={activeRow === 'ja' && hasError} />
    ) : (
      it.ja
    )
  return (
    <div className="flow ticker pairs">
      <div className="flow-track" ref={trackRef}>
        <div className="flow-strip" ref={stripRef}>
          {items.map((it, k) => {
            const isCur = k === cur
            const state = isCur ? 'current' : k < cur ? 'past' : 'future'
            return (
              <span
                key={it.sentenceIndex ?? k}
                ref={isCur ? curRef : null}
                className={`flow-pair ${state}`}
              >
                <span className={`pair-en ${isCur && activeRow === 'en' ? 'typing' : ''}`}>
                  {isCur ? (
                    <Typed text={it.en} done={enDone} hasError={activeRow === 'en' && hasError} />
                  ) : (
                    it.en
                  )}
                </span>
                <span className={`pair-ja ${isCur && activeRow === 'ja' ? 'typing' : ''}`}>
                  {renderJa(it, isCur)}
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export interface FlowProps {
  items: FlowItem[]
  cur: number
  enDone: number
  jaDone: number
  jaKanaDone?: number
  hasError?: boolean
  activeRow: 'en' | 'ja' | null
  showEn?: boolean
  showJa?: boolean
  wrap?: boolean
  ticker?: boolean
  isBoth?: boolean
}

// items=[{en,ja}], cur=現在index, enDone/jaDone=現在文の進捗, jaKanaDone=読み(かな)の進捗, activeRow='en'|'ja'|null
export function Flow({
  items,
  cur,
  enDone,
  jaDone,
  jaKanaDone = 0,
  hasError = false,
  activeRow,
  showEn = true,
  showJa = true,
  wrap = false,
  ticker = false,
  isBoth = false,
}: FlowProps) {
  // 1文字ごとスクロール用の進捗(0..1)。en=入力文字/語長、ja=かな進捗/かな長。
  const current = items[cur]
  const enLen = current ? [...current.en].length : 0
  const enFrac = enLen ? Math.min(1, enDone / enLen) : 0
  let jaFrac = 0
  if (current) {
    const unit = current.kana ? [...current.kana].length : [...current.ja].length
    const doneU = current.kana ? jaKanaDone : jaDone
    jaFrac = unit ? Math.min(1, doneU / unit) : 0
  }

  // 単一言語モードは2行の左スクロールを親で同期。アクティブ言語の実カーソル位置(cursorFrac)で
  // 左端ピン＋末尾優先クランプを決め、実効先頭 x を両行が共有＝文頭 x が一致。
  const cursorFrac = activeRow === 'en' ? enFrac : activeRow === 'ja' ? jaFrac : 0
  const { en: enScroll, ja: jaScroll } = useSingleLangTicker(
    activeRow,
    cursorFrac,
    cur,
    items.length,
  )

  // 英語・日本語モードはペア表示（英語→和訳の順で1ペアぶん進捗）。
  if (ticker && isBoth) {
    const pairFrac =
      activeRow === 'en' ? enFrac * 0.5 : activeRow === 'ja' ? 0.5 + jaFrac * 0.5 : 0
    return (
      <PairFlow
        items={items}
        cur={cur}
        enDone={enDone}
        jaDone={jaDone}
        jaKanaDone={jaKanaDone}
        hasError={hasError}
        activeRow={activeRow}
        frac={pairFrac}
      />
    )
  }

  return (
    <div className={`flow ${wrap ? 'wrap' : ''} ${ticker ? 'ticker' : ''}`}>
      {showEn && (
        <FlowRow
          tag="英語"
          tagClass="en"
          items={items}
          cur={cur}
          ticker={ticker}
          scroll={enScroll}
          active={activeRow === 'en'}
          render={(it, isCur) =>
            isCur ? (
              <Typed text={it.en} done={enDone} hasError={activeRow === 'en' && hasError} />
            ) : (
              it.en
            )
          }
        />
      )}
      {showJa && (
        <FlowRow
          tag="日本語"
          tagClass="ja"
          items={items}
          cur={cur}
          ticker={ticker}
          scroll={jaScroll}
          active={activeRow === 'ja'}
          render={(it, isCur) => (
            <span className="flow-ja">
              {it.kana ? (
                isCur ? (
                  <RubyTyped
                    ja={it.ja}
                    kana={it.kana}
                    done={jaDone}
                    kanaDone={jaKanaDone}
                    hasError={activeRow === 'ja' && hasError}
                  />
                ) : (
                  <RubyText ja={it.ja} kana={it.kana} />
                )
              ) : isCur ? (
                <Typed text={it.ja} done={jaDone} hasError={activeRow === 'ja' && hasError} />
              ) : (
                it.ja
              )}
            </span>
          )}
        />
      )}
    </div>
  )
}
