import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STORY } from './story.js'
import {
  buildUnits,
  choiceSeg,
  consumedWords,
  guideText,
  kanjiDone,
  segMatches,
  typingLang,
} from './typing.js'
import { Chars, Chips, Flow, MaskedText, StatsRow } from './ui.jsx'

const FOUND_KEY = 'story-endings-v1'

function loadFound() {
  try {
    const a = JSON.parse(localStorage.getItem(FOUND_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

// 現在打っているセグメントの表示
function ActiveSegment({ seg, input, hasError }) {
  if (seg.translate) {
    const source = seg.type === 'en' ? seg.ja : seg.en
    const target = guideText(seg, input)
    const used = consumedWords(seg, input) // 打ち終えた単語数
    return (
      <>
        <p className="story-prompt">{source}</p>
        {seg.chips && <Chips chips={seg.chips} used={used} />}
        <div className="story-en masked">
          <MaskedText text={target} pos={input.length} hasError={hasError} />
        </div>
      </>
    )
  }
  if (seg.type === 'ja') {
    const done = kanjiDone(seg, input)
    return (
      <div className="story-en">
        <Chars text={seg.ja} done={done} cursor={done} hasError={hasError} />
      </div>
    )
  }
  // en（そのまま）
  return (
    <div className="story-en">
      <Chars text={seg.en} done={input.length} cursor={input.length} hasError={hasError} />
    </div>
  )
}

export default function StoryMode({ mode, modeLabel, start, onExit }) {
  const nodes = STORY.nodes
  // Devジャンプ: start.stage==='choice' なら最初の選択肢ノードから開始
  const init =
    start?.stage === 'choice'
      ? { id: Object.keys(nodes).find((k) => nodes[k].choices) ?? STORY.start, stage: 'choice' }
      : { id: STORY.start, stage: 'text' }
  const [nodeId, setNodeId] = useState(init.id)
  const [stage, setStage] = useState(init.stage) // text | choice | ending
  const [unitIndex, setUnitIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [found, setFound] = useState(loadFound)
  // 計測（物語を通しての累計）
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const startTimeRef = useRef(null)

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
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    startTimeRef.current = null
  }, [])

  // 経過時間の更新（エンディング中は止める）
  useEffect(() => {
    if (stage === 'ending') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [stage])

  const started = startTimeRef.current !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const min = (now - startTimeRef.current) / 60000
    return min > 0 ? Math.round(typedKeys / min) : 0
  }, [now, typedKeys, started])
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTimeRef.current) / 100) / 10
  }, [now, started])

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
          setMistakes((m) => m + 1)
          setHasError(true)
          return
        }
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        setTypedKeys((k) => k + 1)
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
          setMistakes((m) => m + 1)
          setHasError(true)
          return
        }
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        setTypedKeys((k) => k + 1)
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

  // バー＝現在の行（または入力中の選択肢）の進捗
  let barTarget = ''
  if (stage === 'text') barTarget = guideText(units[unitIndex], input)
  else if (stage === 'choice') {
    const s = choiceSegs.find((cs) => segMatches(cs, input))
    barTarget = s ? guideText(s, input) : ''
  }
  const barProgress = barTarget.length ? Math.min(1, input.length / barTarget.length) : 0

  // 英語/日本語フロー（翻訳モード以外で表示）
  const isTranslate = mode === 'en-tr' || mode === 'ja-tr'
  const activeType = units[unitIndex]?.type
  let flowItems = [node]
  {
    let n = node
    let guard = 0
    while (n.next && guard < 4) {
      n = nodes[n.next]
      flowItems.push(n)
      guard += 1
    }
  }
  let enDone = 0
  let jaDone = 0
  if (stage === 'choice') {
    enDone = node.en.length
    jaDone = [...node.ja].length
  } else {
    if (activeType === 'en') enDone = Math.min(input.length, node.en.length)
    else if (mode === 'both') enDone = node.en.length // 英語は入力済み、和文入力中
    if (activeType === 'ja') jaDone = kanjiDone({ ja: node.ja, kana: node.kana }, input)
  }

  return (
    <div className="story">
      <div className="play-meta">
        <span className="meta-badge rank">{STORY.title}</span>
        <span className="meta-badge mode">{modeLabel}</span>
      </div>
      <div className="story-found-line">
        発見エンド {found.length} / {STORY.endingCount}
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
          <StatsRow
            stats={[
              { label: 'タイピング数', value: typedKeys },
              { label: '速度', value: `${liveSpeed} 打/分` },
              { label: 'ミス', value: mistakes },
              { label: '時間', value: `${elapsedSec} 秒` },
            ]}
            progress={barProgress}
          />

          {!isTranslate && (
            <Flow
              items={flowItems}
              cur={0}
              enDone={enDone}
              jaDone={jaDone}
              activeRow={stage === 'choice' ? null : activeType}
              wrap
            />
          )}

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
                          <Chars
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
                          <Chars text={c.ja} done={jaDone} cursor={jaDone} hasError={matched && hasError} />
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
