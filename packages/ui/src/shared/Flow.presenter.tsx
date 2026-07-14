// 英語/日本語のフロー表示。
// - 通常(wrap): 現在文＋先読みを折り返し（長文の例文・物語向け）。
// - ticker: 入力位置を一定に保ち1文字ごとに左スクロール（単語モード向け）。
// - ticker かつ both（英語・日本語）: 英語と和訳を「ペア」で交互に並べる。
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Typed, RubyTyped, RubyText, MaskedText, MaskedRuby } from './Text.presenter'
import { tickerMaskImage } from './tickerMask.util'

export interface FlowItem {
  en: string
  ja: string
  kana?: string
  sentenceIndex?: number
  cloze?: boolean // #402 穴埋め対象語（この語の入力側を伏字にする）
  clozeSide?: 'en' | 'ja' // #402 both で伏せる側（en=英語のみ / ja=読みのみ）。未指定は en 扱い
}

const ANCHOR_RATIO = 0.35 // PairFlow(both) 用：入力位置を画面のこの割合に保つ
const CURSOR_MARGIN = 24 // 末尾カーソルを右端からこの px 内に必ず見せる（末尾優先クランプ用）
// 打鍵ごとに transform を離散更新する（時間ベースのグライドは使わない）。
// ごく短い固定トランジションで1打ぶんの移動を軽く均すだけ（0＝完全離散〜0.06s 目安・実機微調整前提）。
const STEP_TRANSITION_SEC = 0.05

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
  prevOff: number | null // 前文(前語)の offsetLeft（cur=0 では null）
  width: number // 現在文の offsetWidth
  tw: number // track の可視幅
}

function measureRow(r: RowScroll): RowMeasure | null {
  const strip = r.stripRef.current
  const word = r.curRef.current
  const track = r.trackRef.current
  if (!strip || !word || !track) return null
  const prevEl = word.previousElementSibling as HTMLElement | null
  return {
    strip,
    track,
    off: word.offsetLeft,
    prevOff: prevEl ? prevEl.offsetLeft : null,
    width: word.offsetWidth,
    tw: track.clientWidth,
  }
}

// 決まった shift を strip へ適用し、右端フェード(語境界スナップ)を再計算する。
// 動きは transform の値そのものを打鍵ごとに離散更新。トランジションはごく短い固定のみ（グライドは使わない）。
// transition-property/timing-function は CSS(.flow-strip: transform linear)のまま、duration だけ inline で短く上書き。
function applyRow(m: RowMeasure, shift: number, cur: number) {
  m.strip.style.transitionDuration = `${STEP_TRANSITION_SEC}s`
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
// 位置を (現在文 cur, 進捗 frac) の連続関数にし、境界で飛ばず・打鍵ごとに必要幅だけ動かす。
// - shift(cur, frac) = −L_cur + prevAdvance·(1 − frac)。L_cur=現在文 offsetLeft, prevAdvance=L_cur−L_{cur-1}(前文の幅+gap)。
//   frac=1 → shift=−L_cur（現在文の先頭が左端＝全文表示）。cur+1 の frac=0 → shift=−L_cur（前文終端と一致＝境界で飛ばない）。
//   1打ぶんの移動 = prevAdvance / len_cur（乗換の大移動が現在文の打鍵に分散して入ってくる）。
//   cur=0 は prevAdvance=0 → shift=−L_0=0（左端固定・開始空白なし）。
// - クランプ：prevAdvance は tw−CURSOR_MARGIN で上限（次文が画面右外始まりにならない）。
//   長文は末尾優先：カーソル(off+width·frac)が右端−margin を越えないよう shift を下限クランプ（shiftCursor）。
// - 英日同期：アクティブ行の実効先頭 x(= L_cur + shift)を参考行にも共有（両行 abs スクリーン x 一致）。日本語入力時は対称。
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
  useLayoutEffect(() => {
    const mEn = measureRow(en)
    const mJa = measureRow(ja)
    const any = mEn ?? mJa
    if (!any) return // ticker 以外(wrap)や計測前は strip 未描画で何もしない
    const active = activeRow === 'en' ? mEn : activeRow === 'ja' ? mJa : null
    let effStartX = 0 // 実効の文頭 view-x（両行で共有）＝既定は左端(0)
    if (active) {
      // 前文からの前進量。frac=0 で先頭が画面右外へ出ないよう上限クランプ（次文は右端付近から入る）。
      const prevAdvRaw = active.prevOff == null ? 0 : active.off - active.prevOff
      const prevAdv = Math.min(prevAdvRaw, active.tw - CURSOR_MARGIN)
      const baseShift = -active.off + prevAdv * (1 - cursorFrac) // 連続位置関数
      // 末尾優先：長文はカーソルを右端−margin 内に保つよう下限（より左）へ寄せる。
      const shiftCursor = active.tw - CURSOR_MARGIN - (active.off + active.width * cursorFrac)
      const shift = Math.min(baseShift, shiftCursor)
      effStartX = shift + active.off
    }
    if (mEn) applyRow(mEn, effStartX - mEn.off, cur)
    if (mJa) applyRow(mJa, effStartX - mJa.off, cur)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref 束(en/ja)は不変。計測トリガは cursorFrac/cur/len で十分。
  }, [activeRow, cursorFrac, cur, len])
  return { en, ja }
}

interface FlowRowProps {
  tag: string
  tagClass: string
  items: FlowItem[]
  cur: number
  active: boolean
  render: (it: FlowItem, isCur: boolean, isFuture: boolean) => ReactNode
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
      {render(it, k === cur, k > cur)}
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
  clozeRevealed: boolean
}

// both(英語・日本語)用：英語と和訳を1つの「ペア」にまとめ、横一列に交互に並べる。
// #402 穴埋め：both は語ごとに clozeSide で英語 or 読みの「片側だけ」を伏字にする（両側同時には伏せない）。
function PairFlow({ items, cur, enDone, jaDone, jaKanaDone, hasError, activeRow, frac, clozeRevealed }: PairFlowProps) {
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
  // 穴埋め伏字（en/ja）。current は打った分を現し、future は全伏字。revealed で正解を露出。
  // 開示（ミス）時は通常の現在語表示（Typed/renderJa）と同一の見た目にする＝表示方式を変えない(#402)。
  const maskEn = (it: FlowItem, isCur: boolean) =>
    isCur && clozeRevealed ? (
      <Typed text={it.en} done={enDone} hasError={activeRow === 'en' && hasError} />
    ) : (
      <MaskedText text={it.en} pos={isCur ? enDone : -1} hasError={isCur && activeRow === 'en' && hasError} />
    )
  const maskJa = (it: FlowItem, isCur: boolean) => {
    if (isCur && clozeRevealed) return renderJa(it, true)
    return it.kana ? (
      <MaskedRuby
        ja={it.ja}
        kana={it.kana}
        done={isCur ? jaDone : 0}
        kanaDone={isCur ? jaKanaDone : 0}
        hasError={isCur && activeRow === 'ja' && hasError}
      />
    ) : (
      <MaskedText text={it.ja} pos={isCur ? jaDone : -1} hasError={isCur && activeRow === 'ja' && hasError} />
    )
  }
  return (
    <div className="flow ticker pairs">
      <div className="flow-track" ref={trackRef}>
        <div className="flow-strip" ref={stripRef}>
          {items.map((it, k) => {
            const isCur = k === cur
            const state = isCur ? 'current' : k < cur ? 'past' : 'future'
            // 現在＋これから打つ穴埋め語だけ伏字（past は表示）。片側（clozeSide）のみ伏せる。
            const clozeHere = !!it.cloze && k >= cur
            const side = it.clozeSide ?? 'en'
            const maskEnHere = clozeHere && side === 'en'
            const maskJaHere = clozeHere && side === 'ja'
            return (
              <span
                key={it.sentenceIndex ?? k}
                ref={isCur ? curRef : null}
                className={`flow-pair ${state}`}
              >
                <span className={`pair-en ${isCur && activeRow === 'en' ? 'typing' : ''}`}>
                  {maskEnHere ? (
                    maskEn(it, isCur)
                  ) : isCur ? (
                    <Typed text={it.en} done={enDone} hasError={activeRow === 'en' && hasError} />
                  ) : (
                    it.en
                  )}
                </span>
                <span className={`pair-ja ${isCur && activeRow === 'ja' ? 'typing' : ''}`}>
                  {maskJaHere ? maskJa(it, isCur) : renderJa(it, isCur)}
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
  clozeRevealed?: boolean // #402 現在語(cloze)でミスがあり正解を開示中か
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
  clozeRevealed = false,
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
        clozeRevealed={clozeRevealed}
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
          render={(it, isCur, isFuture) => {
            // #402 穴埋め：英語入力側の cloze 語(現在/これから)は伏字。past・非対象は従来表示。
            if (it.cloze && activeRow === 'en' && (isCur || isFuture)) {
              // 開示（ミス）時は通常の現在語表示と同一にする＝表示方式を変えない(#402)。
              if (isCur && clozeRevealed) return <Typed text={it.en} done={enDone} hasError={hasError} />
              return <MaskedText text={it.en} pos={isCur ? enDone : -1} hasError={isCur && hasError} />
            }
            return isCur ? (
              <Typed text={it.en} done={enDone} hasError={activeRow === 'en' && hasError} />
            ) : (
              it.en
            )
          }}
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
          render={(it, isCur, isFuture) => (
            <span className="flow-ja">
              {it.cloze && activeRow === 'ja' && (isCur || isFuture) ? (
                // #402 穴埋め：日本語入力側の cloze 語(現在/これから)は伏字。past・非対象は従来表示。
                // 開示（ミス）時は通常の現在語表示（RubyTyped/Typed）と同一にする＝表示方式を変えない。
                isCur && clozeRevealed ? (
                  it.kana ? (
                    <RubyTyped
                      ja={it.ja}
                      kana={it.kana}
                      done={jaDone}
                      kanaDone={jaKanaDone}
                      hasError={hasError}
                    />
                  ) : (
                    <Typed text={it.ja} done={jaDone} hasError={hasError} />
                  )
                ) : it.kana ? (
                  <MaskedRuby
                    ja={it.ja}
                    kana={it.kana}
                    done={isCur ? jaDone : 0}
                    kanaDone={isCur ? jaKanaDone : 0}
                    hasError={isCur && hasError}
                  />
                ) : (
                  <MaskedText text={it.ja} pos={isCur ? jaDone : -1} hasError={isCur && hasError} />
                )
              ) : it.kana ? (
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
