// 英語/日本語の二段フロー（現在＋先読みを折り返し表示）。
import { useLayoutEffect, useRef } from 'react'
import { Typed, RubyTyped, RubyText } from './Text.jsx'

// 1行ぶん。現在文を明るく＋進捗、先の文は薄く。
// ticker=true のときは現在語の左端を固定し、ストリップ全体を translateX で滑らかに左スクロールする
// （完了語は左へ流れてフェード・クリップ）。現在語は常に全文字が見える。
// transform は ref で直接更新（state を持たず再レンダーを起こさない／CSS transition は効く）。
function FlowRow({ tag, tagClass, items, cur, active, render, ticker }) {
  const curRef = useRef(null)
  const stripRef = useRef(null)
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const offset = curRef.current ? curRef.current.offsetLeft : 0
    strip.style.transform = `translateX(${-offset}px)`
  }, [cur, items.length])

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
      <div className="flow-track">
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
}) {
  return (
    <div className={`flow ${wrap ? 'wrap' : ''} ${ticker ? 'ticker' : ''}`}>
      {showEn && (
        <FlowRow
          tag="英語"
          tagClass="en"
          items={items}
          cur={cur}
          ticker={ticker}
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
