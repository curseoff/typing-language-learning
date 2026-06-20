import { useCallback, useEffect, useMemo, useState } from 'react'
import { STORY } from './story.js'
import {
  buildUnits,
  choiceSeg,
  guideText,
  kanjiDone,
  segMatches,
  typingLang,
} from './typing.js'

const FOUND_KEY = 'story-endings-v1'

function loadFound() {
  try {
    const a = JSON.parse(localStorage.getItem(FOUND_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

// 英字/かな1文字ずつの色分け
function PlainChars({ text, done, cursor, hasError }) {
  return [...text].map((ch, i) => {
    let cls = 'ch'
    if (i < done) cls += ' done'
    else if (i === cursor) cls += hasError ? ' cur err' : ' cur'
    return (
      <span key={i} className={cls}>
        {ch}
      </span>
    )
  })
}

// 翻訳モードの伏せ字（打った分だけ現れる）
function MaskedChars({ text, pos, hasError }) {
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

// 現在打っているセグメントの表示
function ActiveSegment({ seg, input, hasError }) {
  if (seg.translate) {
    const source = seg.type === 'en' ? seg.ja : seg.en
    const target = guideText(seg, input)
    return (
      <>
        <p className="story-prompt">{source}</p>
        {seg.chips && (
          <div className="tr-chips">
            {seg.chips.map((w, i) => (
              <span key={i} className="chip">
                {w}
              </span>
            ))}
          </div>
        )}
        <div className="story-en masked">
          <MaskedChars text={target} pos={input.length} hasError={hasError} />
        </div>
      </>
    )
  }
  if (seg.type === 'ja') {
    const done = kanjiDone(seg, input)
    return (
      <>
        <div className="story-en">
          <PlainChars text={seg.ja} done={done} cursor={done} hasError={hasError} />
        </div>
        <p className="story-ref">{seg.en}</p>
      </>
    )
  }
  // en（そのまま）
  return (
    <>
      <div className="story-en">
        <PlainChars text={seg.en} done={input.length} cursor={input.length} hasError={hasError} />
      </div>
      <p className="story-ref">{seg.ja}</p>
    </>
  )
}

export default function StoryMode({ mode, onExit }) {
  const nodes = STORY.nodes
  const [nodeId, setNodeId] = useState(STORY.start)
  const [stage, setStage] = useState('text') // text | choice | ending
  const [unitIndex, setUnitIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [found, setFound] = useState(loadFound)

  const node = nodes[nodeId]
  const lang = typingLang(mode)
  const units = useMemo(() => buildUnits(node, mode), [node, mode])
  const choiceSegs = useMemo(
    () => (node.choices ? node.choices.map((c) => choiceSeg(c, mode)) : []),
    [node, mode],
  )

  const reset = () => {
    setInput('')
    setHasError(false)
    setUnitIndex(0)
  }

  const restart = useCallback(() => {
    setNodeId(STORY.start)
    setStage('text')
    reset()
  }, [])

  const enterEnding = useCallback((n) => {
    setStage('ending')
    setFound((prev) => {
      if (prev.includes(n.ending)) return prev
      const upd = [...prev, n.ending]
      localStorage.setItem(FOUND_KEY, JSON.stringify(upd))
      return upd
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      if (stage === 'ending') {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault()
          restart()
        }
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const candidate = input + e.key

      if (stage === 'text') {
        const seg = units[unitIndex]
        if (!segMatches(seg, candidate)) {
          setHasError(true)
          return
        }
        setHasError(false)
        if (seg.variants.includes(candidate)) {
          setInput('')
          if (unitIndex < units.length - 1) {
            setUnitIndex(unitIndex + 1)
          } else {
            setUnitIndex(0)
            if (node.ending) enterEnding(node)
            else if (node.choices) setStage('choice')
            else if (node.next) setNodeId(node.next)
          }
        } else {
          setInput(candidate)
        }
      } else {
        // choice
        if (!choiceSegs.some((s) => segMatches(s, candidate))) {
          setHasError(true)
          return
        }
        setHasError(false)
        const idx = choiceSegs.findIndex((s) => s.variants.includes(candidate))
        if (idx >= 0) {
          setStage('text')
          reset()
          setNodeId(node.choices[idx].next)
        } else {
          setInput(candidate)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, node, units, unitIndex, choiceSegs, input, onExit, restart, enterEnding])

  return (
    <div className="story">
      <div className="story-head">
        <button className="story-exit" onClick={onExit}>
          ← トップ
        </button>
        <span className="story-title">{STORY.title}</span>
        <span className="story-found">
          発見エンド {found.length} / {STORY.endingCount}
        </span>
      </div>

      {stage === 'ending' ? (
        <div className="story-ending">
          <div className="ending-badge">{node.endLabel}</div>
          <p className="ending-text">{node.en}</p>
          <p className="ending-ja">{node.ja}</p>
          <div className="ending-actions">
            <button className="btn-primary" onClick={restart}>
              最初から
            </button>
            <button className="story-exit" onClick={onExit}>
              トップへ
            </button>
          </div>
          <p className="key-hint">
            <kbd>Space</kbd> 最初から / <kbd>Esc</kbd> トップ
          </p>
        </div>
      ) : (
        <>
          {units.length > 1 && (
            <div className="story-progress">
              {unitIndex + 1} / {units.length}（{units[unitIndex].type === 'en' ? '英語' : '日本語'}）
            </div>
          )}

          <ActiveSegment seg={units[unitIndex]} input={input} hasError={hasError} />

          {stage === 'choice' && (
            <div className="story-choices">
              {node.choices.map((c, i) => {
                const seg = choiceSegs[i]
                const matched = segMatches(seg, input)
                const enDone = lang === 'en' && matched ? input.length : 0
                const jaDone = lang === 'ja' && matched ? kanjiDone(seg, input) : 0
                return (
                  <div key={i} className={`story-choice ${matched ? '' : 'dim'}`}>
                    <span className="choice-key">{'ABC'[i]}</span>
                    <div className="choice-body">
                      <div className="choice-en">
                        {lang === 'en' ? (
                          <PlainChars
                            text={c.en}
                            done={enDone}
                            cursor={matched ? input.length : -1}
                            hasError={matched && hasError}
                          />
                        ) : (
                          c.en
                        )}
                      </div>
                      <div className="choice-ja">
                        {lang === 'ja' ? (
                          <PlainChars text={c.ja} done={jaDone} cursor={jaDone} hasError={matched && hasError} />
                        ) : (
                          c.ja
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="hint">
            {stage === 'text'
              ? '表示された文を入力。'
              : '選択肢のどれか1つを最後まで入力すると進みます。'}
            <kbd>Esc</kbd> でトップへ。
          </p>
        </>
      )}
    </div>
  )
}
