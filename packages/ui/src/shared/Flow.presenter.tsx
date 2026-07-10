// 英語/日本語のフロー表示。
// - 通常(wrap): 現在文＋先読みを折り返し（長文の例文・物語向け）。
// - ticker: 入力位置を一定に保ち1文字ごとに左スクロール（単語モード向け）。
// - ticker かつ both（英語・日本語）: 英語と和訳を「ペア」で交互に並べる。
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Typed, RubyTyped, RubyText } from './Text.presenter'
import { tickerMaskImage } from './tickerMask.util'

export interface FlowItem {
  en: string
  ja: string
  kana?: string
  sentenceIndex?: number
}

const ANCHOR_RATIO = 0.35 // 入力位置を画面のこの割合に保つ

// 入力位置(offsetLeft + 幅×frac)を ANCHOR に保つよう transform を ref で直接更新（1文字ごと左スクロール）。
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

interface FlowRowProps {
  tag: string
  tagClass: string
  items: FlowItem[]
  cur: number
  active: boolean
  render: (it: FlowItem, isCur: boolean) => ReactNode
  ticker: boolean
  frac?: number
}

// 1行ぶん。現在文を明るく＋進捗、先の文は薄く。ticker=true で1文字ごとの左スクロール。
function FlowRow({ tag, tagClass, items, cur, active, render, ticker, frac = 0 }: FlowRowProps) {
  const { trackRef, stripRef, curRef } = useTickerScroll(frac, cur, items.length)
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
          frac={enFrac}
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
          frac={jaFrac}
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
