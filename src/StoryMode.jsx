import { useCallback, useEffect, useState } from 'react'
import { STORY } from './story.js'

const FOUND_KEY = 'story-endings-v1'

function loadFound() {
  try {
    const a = JSON.parse(localStorage.getItem(FOUND_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

// テキストを1文字ずつ表示(打った分を色分け)
function TypeChars({ text, done, cursor, hasError }) {
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

export default function StoryMode({ onExit }) {
  const nodes = STORY.nodes
  const [nodeId, setNodeId] = useState(STORY.start)
  const [stage, setStage] = useState('text') // text | choice | ending
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [found, setFound] = useState(loadFound)

  const node = nodes[nodeId]

  const restart = useCallback(() => {
    setNodeId(STORY.start)
    setStage('text')
    setInput('')
    setHasError(false)
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

  // 本文を打ち終えた後の進行
  const finishText = useCallback(() => {
    setInput('')
    if (node.ending) enterEnding(node)
    else if (node.choices) setStage('choice')
    else if (node.next) {
      setNodeId(node.next)
      setStage('text')
    }
  }, [node, enterEnding])

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

      const targets = stage === 'text' ? [node.en] : node.choices.map((c) => c.en)
      const candidate = input + e.key
      if (!targets.some((t) => t.startsWith(candidate))) {
        setHasError(true)
        return
      }
      setHasError(false)
      const completed = targets.includes(candidate)
      if (!completed) {
        setInput(candidate)
        return
      }
      // 完了
      if (stage === 'text') {
        finishText()
      } else {
        const choice = node.choices.find((c) => c.en === candidate)
        setInput('')
        setStage('text')
        setNodeId(choice.next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, node, input, onExit, finishText, restart])

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
          <p className="story-ja">{node.ja}</p>
          <div className="story-en">
            <TypeChars
              text={node.en}
              done={stage === 'text' ? input.length : node.en.length}
              cursor={stage === 'text' ? input.length : -1}
              hasError={stage === 'text' && hasError}
            />
          </div>

          {stage === 'choice' && (
            <div className="story-choices">
              {node.choices.map((c, i) => {
                const matched = c.en.startsWith(input)
                return (
                  <div key={i} className={`story-choice ${matched ? '' : 'dim'}`}>
                    <span className="choice-key">{'ABC'[i]}</span>
                    <div className="choice-body">
                      <div className="choice-en">
                        <TypeChars
                          text={c.en}
                          done={matched ? input.length : 0}
                          cursor={matched ? input.length : -1}
                          hasError={matched && hasError}
                        />
                      </div>
                      <div className="choice-ja">{c.ja}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="hint">
            {stage === 'text'
              ? '表示された英文を入力。'
              : '選択肢のどれか1つを最後まで入力すると進みます。'}
            <kbd>Esc</kbd> でトップへ。
          </p>
        </>
      )}
    </div>
  )
}
