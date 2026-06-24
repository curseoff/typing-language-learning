// 物語の状態機械（ノード遷移・分岐・エンド・計測）。
// StoryView 内で呼ぶ前提（物語フェーズの間だけマウントされる）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STORY } from '../content/story.js'
import { buildUnits, choiceSeg, segMatches, typingLang } from '../domain/typing/units.js'
import { firstChoiceNodeId } from '../domain/story/navigation.js'
import { score } from '../domain/marathon/scoring.js'
import {
  loadFound,
  saveFound,
  loadStoryRecords,
  saveStoryRecord,
} from '../infrastructure/storyRepository.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'

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
  const [records, setRecords] = useState(loadStoryRecords) // 記録ランキング
  const [result, setResult] = useState(null) // 今回のプレイ結果
  // 計測（物語を通しての累計）
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const trackerRef = useRef(newTracker()) // 場面ごとの累積記録（ノード単位×モード別）

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
    flushTracker(trackerRef.current)
    setNodeId(STORY.start)
    setStage('text')
    reset()
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setResult(null)
    setStartTime(null)
  }, [])

  // 経過時間の更新（エンディング中は止める）
  useEffect(() => {
    if (stage === 'ending') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [stage])

  const started = startTime !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const min = (now - startTime) / 60000
    return min > 0 ? Math.round(typedKeys / min) : 0
  }, [now, typedKeys, started, startTime])
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTime) / 100) / 10
  }, [now, started, startTime])

  const enterEnding = useCallback((n, keys, totalMistakes, endTime, startedAt) => {
    flushTracker(trackerRef.current) // エンド到達時に現在の場面を確定
    setStage('ending')
    setFound((prev) => {
      if (prev.includes(n.ending)) return prev
      const upd = [...prev, n.ending]
      saveFound(upd)
      return upd
    })
    // 今回の記録を作成・保存（速い順ランキング）
    const elapsedMs = startedAt ? endTime - startedAt : 0
    const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
    const record = {
      ending: n.ending,
      endLabel: n.endLabel,
      speed,
      keys,
      mistakes: totalMistakes,
      accuracy,
      seconds,
      date: new Date().toLocaleString('ja-JP'),
    }
    setResult(record)
    setRecords(saveStoryRecord(record))
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        flushTracker(trackerRef.current)
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
          trackMiss(trackerRef.current)
          setHasError(true)
          return
        }
        const _t = performance.now()
        const startedAt = startTime ?? _t // この打鍵で開始した場合も正しい開始時刻を使う
        setStartTime((p) => p ?? _t)
        setHasError(false)
        trackKey(trackerRef.current, itemId('story', mode, nodeId)) // 場面ごと×モード別
        setTypedKeys((k) => k + 1)
        if (seg.variants.includes(candidate)) {
          setInput('')
          if (unitIndex < units.length - 1) {
            setUnitIndex(unitIndex + 1)
          } else {
            setUnitIndex(0)
            if (node.ending) enterEnding(node, typedKeys + 1, mistakes, performance.now(), startedAt)
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
          trackMiss(trackerRef.current)
          setHasError(true)
          return
        }
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        trackKey(trackerRef.current, itemId('story', mode, nodeId)) // 選択肢も現在の場面に集約
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
  }, [stage, node, nodeId, mode, units, unitIndex, choiceSegs, input, typedKeys, mistakes, startTime, onExit, restart, enterEnding])

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
    result,
    records,
    restart,
  }
}
