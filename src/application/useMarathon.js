// マラソンのゲームセッション（状態機械）。
// active=このモードが表示中か / onFinish(record, segStats)=600到達時に呼ぶ。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TARGET_KEYS, buildPassage } from '../domain/marathon/passage.js'
import { score } from '../domain/marathon/scoring.js'
import { mulberry32 } from '../domain/rng.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'

export function useMarathon({ active, onFinish }) {
  const [segments, setSegments] = useState([])
  const [segIndex, setSegIndex] = useState(0)
  const [segInput, setSegInput] = useState('') // 現在セグメントに打ったローマ字/英字
  const [completed, setCompleted] = useState([]) // 確定したセグメントの入力文字列
  const [typedKeys, setTypedKeys] = useState(0) // 正しく打った総文字数
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [now, setNow] = useState(0)
  const [startTime, setStartTime] = useState(null)

  const segStartRef = useRef(null) // 現在の問題の開始時刻
  const segMistakesRef = useRef(0) // 現在の問題のミス数
  const segStatsRef = useRef([]) // 確定した問題ごとの記録
  const ctxRef = useRef({ mode: 'both', rank: 1 }) // 開始時の mode/rank/source/seed
  const trackerRef = useRef(newTracker()) // 問題ごとの累積記録（文単位）

  // 経過時間の更新
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [active])

  const start = useCallback((mode, rank, source, pool, seed) => {
    ctxRef.current = { mode, rank, source, seed }
    // seed があれば決定的な問題列を再現（リプレイ）。無ければ Math.random で通常出題。
    const opts = seed != null ? { rng: mulberry32(seed) } : {}
    setSegments(buildPassage(mode, pool, opts))
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    setTypedKeys(0)
    setMistakes(0)
    setHasError(false)
    setNow(0)
    setStartTime(null)
    segStartRef.current = null
    segMistakesRef.current = 0
    segStatsRef.current = []
    trackerRef.current = newTracker()
  }, [])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const { mode, rank, source, seed } = ctxRef.current
      const record = {
        mode,
        rank,
        source,
        seed, // 同じ問題列を再現するためのシード（リプレイ用）
        speed,
        keys,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      onFinish(record, segStatsRef.current)
    },
    [onFinish],
  )

  const handleKey = useCallback(
    (e) => {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        const t = performance.now()
        const startedAt = startTime ?? t // この打鍵で開始した場合も正しい開始時刻を使う
        setStartTime((p) => p ?? t)
        if (segStartRef.current === null) segStartRef.current = t // 問題の最初の打鍵
        setHasError(false)
        trackKey(trackerRef.current, itemId('s', ctxRef.current.mode, seg.en)) // 文ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)

        const completesSeg = seg.variants.includes(candidate)
        const reachedGoal = newKeys >= TARGET_KEYS

        // 問題が終わった(完了 or 600到達で打ち切り)ら記録
        if (completesSeg || reachedGoal) {
          const segKeys = candidate.length
          const ms = t - segStartRef.current
          segStatsRef.current = [
            ...segStatsRef.current,
            {
              no: segStatsRef.current.length + 1,
              type: seg.type,
              label: seg.type === 'en' ? seg.en : seg.ja,
              keys: segKeys,
              mistakes: segMistakesRef.current,
              seconds: Math.round(ms / 100) / 10,
              speed: ms > 0 ? Math.round(segKeys / (ms / 60000)) : 0,
              partial: !completesSeg,
            },
          ]
          segStartRef.current = null
          segMistakesRef.current = 0
        }

        if (reachedGoal) {
          flushTracker(trackerRef.current)
          finish(newKeys, mistakes, t, startedAt)
          return
        }

        if (completesSeg) {
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setSegInput('')
        } else {
          setSegInput(candidate)
        }
      } else {
        setMistakes((m) => m + 1)
        segMistakesRef.current += 1
        trackMiss(trackerRef.current)
        setHasError(true)
      }
    },
    [segments, segIndex, segInput, typedKeys, mistakes, startTime, finish],
  )

  useEffect(() => {
    if (!active) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, handleKey])

  const started = startTime !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const minutes = (now - startTime) / 60000
    return minutes > 0 ? Math.round(typedKeys / minutes) : 0
  }, [now, typedKeys, started, startTime])
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTime) / 100) / 10
  }, [now, started, startTime])

  return {
    start,
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
  }
}
