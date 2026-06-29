// マラソンのゲームセッション（状態機械）。
// active=このモードが表示中か / onFinish(record, segStats)=最初の打鍵から60秒で呼ぶ。
import { useCallback, useEffect, useRef, useState } from 'react'
import { buildPassage } from '../domain/marathon/passage.js'
import { score } from '../domain/marathon/scoring.js'
import { mulberry32 } from '../domain/rng.js'
import { useCountdownTimer } from './useCountdownTimer.js'
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
  const [startTime, setStartTime] = useState(null)

  const segStartRef = useRef(null) // 現在の問題の開始時刻
  const segMistakesRef = useRef(0) // 現在の問題のミス数
  const segStatsRef = useRef([]) // 確定した問題ごとの記録
  const ctxRef = useRef({ mode: 'both', rank: 1 }) // 開始時の mode/rank/source/seed
  const trackerRef = useRef(newTracker()) // 問題ごとの累積記録（文単位）
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード
  // 時間切れ finish 用に最新の打鍵数/ミス/開始時刻を effect から参照する
  const keysRef = useRef(0)
  const mistakesRef = useRef(0)
  const startTimeRef = useRef(null)

  const start = useCallback((mode, rank, source, pool, seed, theme) => {
    ctxRef.current = { mode, rank, source, seed, theme }
    // seed があれば決定的な問題列を再現（リプレイ）。無ければ Math.random で通常出題。
    const opts = seed != null ? { rng: mulberry32(seed) } : {}
    setSegments(buildPassage(mode, pool, opts))
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    setTypedKeys(0)
    setMistakes(0)
    setHasError(false)
    setStartTime(null)
    segStartRef.current = null
    segMistakesRef.current = 0
    segStatsRef.current = []
    trackerRef.current = newTracker()
    finishedRef.current = false
    keysRef.current = 0
    mistakesRef.current = 0
    startTimeRef.current = null
  }, [])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const { mode, rank, source, seed, theme } = ctxRef.current
      const record = {
        mode,
        rank,
        source,
        theme, // テーマ別ランキング用（単語例文）。未指定モードは undefined のまま

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

      if (finishedRef.current) return
      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        const t = performance.now()
        setStartTime((p) => p ?? t)
        startTimeRef.current = startTimeRef.current ?? t // 時間切れ finish 用
        if (segStartRef.current === null) segStartRef.current = t // 問題の最初の打鍵
        setHasError(false)
        trackKey(trackerRef.current, itemId('s', ctxRef.current.mode, seg.en)) // 文ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        keysRef.current = newKeys

        const completesSeg = seg.variants.includes(candidate)

        // 問題が完了したら記録（時間切れ時の未完セグは finish 側で partial 記録）
        if (completesSeg) {
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
              partial: false,
            },
          ]
          segStartRef.current = null
          segMistakesRef.current = 0
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setSegInput('')
        } else {
          setSegInput(candidate)
        }
      } else {
        setMistakes((m) => {
          mistakesRef.current = m + 1
          return m + 1
        })
        segMistakesRef.current += 1
        trackMiss(trackerRef.current)
        setHasError(true)
      }
    },
    [segments, segIndex, segInput, typedKeys],
  )

  useEffect(() => {
    if (!active) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, handleKey])

  // 最初の正しい打鍵から60秒で終了（キー入力が無くても時間で finish）。
  // 未完セグは partial として segStats に積んでから onFinish を呼ぶ。
  const onTimeout = (endTime, startedAt) => {
    const t = endTime
    const seg = segments[segIndex]
    if (seg && segInput.length > 0 && segStartRef.current !== null) {
      const ms = t - segStartRef.current
      segStatsRef.current = [
        ...segStatsRef.current,
        {
          no: segStatsRef.current.length + 1,
          type: seg.type,
          label: seg.type === 'en' ? seg.en : seg.ja,
          keys: segInput.length,
          mistakes: segMistakesRef.current,
          seconds: Math.round(ms / 100) / 10,
          speed: ms > 0 ? Math.round(segInput.length / (ms / 60000)) : 0,
          partial: true,
        },
      ]
    }
    flushTracker(trackerRef.current)
    finish(keysRef.current, mistakesRef.current, t, startedAt)
  }
  const { elapsedSec, liveSpeed: speedFor } = useCountdownTimer({ active, startTime, onTimeout })

  return {
    start,
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed: speedFor(typedKeys),
    elapsedSec,
  }
}
