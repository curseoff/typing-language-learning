// 物語の状態機械（ノード遷移・分岐・エンド・計測）。
// StoryView 内で呼ぶ前提（物語フェーズの間だけマウントされる）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STORY } from '../content/story.js'
import { buildUnits, choiceSeg, segMatches, typingLang } from '../domain/typing/units.js'
import { firstChoiceNodeId } from '../domain/story/navigation.js'
import { loadFound, saveFound } from '../infrastructure/storyRepository.js'

export function useStory({ mode, start, onExit }) {
  const nodes = STORY.nodes
  // Devジャンプ: start.stage==='choice' なら最初の選択肢ノードから開始
  const init =
    start?.stage === 'choice'
      ? { id: firstChoiceNodeId(nodes) ?? STORY.start, stage: 'choice' }
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
      saveFound(upd)
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
        if (e.key === 'Enter') {
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

  return {
    nodes,
    node,
    stage,
    units,
    unitIndex,
    input,
    hasError,
    found,
    lang,
    choiceSegs,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    restart,
  }
}
