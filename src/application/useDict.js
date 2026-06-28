// 英英辞典の入力モード（英語入力=定義文を打つ / 日本語入力=和訳を打つ / both=英→日）。
// 単語例文（マラソン）と同じ「最初の打鍵から60秒で終了」方式。問題が尽きたら継ぎ足してループする。
// 記録は dict 記録（DictResult）を維持する。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TIME_LIMIT_MS, buildPassage } from '../domain/marathon/passage.js'
import { score } from '../domain/marathon/scoring.js'
import { mulberry32 } from '../domain/rng.js'
import { loadDictRecords, saveDictRecord } from './records.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { newSegTracker, segMark, segMiss, segPush } from './segTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'
import { makeSeed } from './seed.js'

// dict を level/theme で絞り、buildPassage の pool 形式 {word, en, ja, kana} に整える。
function dictPool(dict, level, theme) {
  let p = dict.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  if (p.length === 0) p = dict.filter((d) => d.level === level)
  if (p.length === 0) p = dict
  return p.map((e) => ({ word: e.word, en: e.def, ja: e.ja, kana: e.kana }))
}

export function useDict({ dict, level, theme, mode, seed, onExit }) {
  // 「今プレイ中の問題列」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに切り直し、record には必ずこの seed を保存して再現可能にする。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  const pool = useMemo(() => dictPool(dict, level, theme), [dict, level, theme])
  const buildSegments = useCallback(
    (s) => buildPassage(mode, pool, { rng: mulberry32(s) }),
    [mode, pool],
  )
  const [segments, setSegments] = useState(() => buildSegments(sessionSeed))
  const [segIndex, setSegIndex] = useState(0)
  const [segInput, setSegInput] = useState('') // 現在セグメントに打った文字
  const [completed, setCompleted] = useState([]) // 確定したセグメントの入力文字列
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [now, setNow] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadDictRecords())
  const trackerRef = useRef(newTracker()) // 見出し語ごとの累積記録
  const segTrackerRef = useRef(newSegTracker()) // 今回プレイの問題ごとの記録
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード
  const timeUpRef = useRef(false) // 時間切れ処理を一度だけ行うガード
  const keysRef = useRef(0) // 時間切れ finish 用の最新打鍵数
  const mistakesRef = useRef(0) // 時間切れ finish 用の最新ミス数

  const restart = useCallback(() => {
    flushTracker(trackerRef.current)
    trackerRef.current = newTracker()
    segTrackerRef.current = newSegTracker()
    // 「もう一度」は毎回新しい問題列にする＝新しい seed を切り直して record にも反映。
    const next = makeSeed()
    setSessionSeed(next)
    setSegments(buildSegments(next))
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    setTypedKeys(0)
    setMistakes(0)
    setHasError(false)
    setNow(0)
    setStartTime(null)
    setFinished(false)
    setResult(null)
    finishedRef.current = false
    timeUpRef.current = false
    keysRef.current = 0
    mistakesRef.current = 0
  }, [buildSegments])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [finished])

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

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const list = segTrackerRef.current.list
      // 打ち終えた「文の数」。both は1文=en+ja の2セグなので、sentenceIndex のユニーク数で数える。
      const words = new Set(list.map((s) => s.sentenceIndex)).size
      const record = {
        source: 'dict', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        level,
        theme,
        mode,
        speed,
        keys,
        words,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        segStats: list,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, sessionSeed],
  )

  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      if (finished) {
        if (e.key === 'Enter') {
          e.preventDefault()
          restart()
        }
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      if (finishedRef.current) return

      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        const t = performance.now()
        setStartTime((p) => p ?? t)
        setHasError(false)
        segMark(segTrackerRef.current, t) // この問題の最初の打鍵時刻
        trackKey(trackerRef.current, itemId('d', mode, seg.word)) // 見出し語ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        keysRef.current = newKeys

        const completesSeg = seg.variants.includes(candidate)

        // 問題が完了したら「問題ごとの記録」に積む（未完は60秒 finish 側で partial 記録）
        if (completesSeg) {
          segPush(segTrackerRef.current, {
            type: seg.type,
            label: seg.word,
            keys: candidate.length,
            t,
            partial: false,
            sentenceIndex: seg.sentenceIndex,
          })
          // 問題を打ち尽くしたら継ぎ足してループ（sentenceIndex は衝突しないようオフセット）。
          if (segIndex + 1 >= segments.length) {
            setSegments((prev) => {
              const offset = prev.length ? prev[prev.length - 1].sentenceIndex + 1 : 0
              const more = buildSegments(makeSeed()).map((s) => ({
                ...s,
                sentenceIndex: s.sentenceIndex + offset,
              }))
              return [...prev, ...more]
            })
          }
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
        trackMiss(trackerRef.current)
        segMiss(segTrackerRef.current)
        setHasError(true)
      }
    },
    [finished, segments, segIndex, segInput, typedKeys, mode, buildSegments, onExit, restart],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // 最初の打鍵から60秒で終了（キー入力が無くても時間で finish）。
  // 現在入力中の問題があれば partial として記録に積んでから finish。
  useEffect(() => {
    if (finished || startTime === null || timeUpRef.current) return
    if (now - startTime < TIME_LIMIT_MS) return
    timeUpRef.current = true // partial 記録と finish 予約は一度だけ
    const t = startTime + TIME_LIMIT_MS
    const seg = segments[segIndex]
    if (seg && segInput.length > 0) {
      segPush(segTrackerRef.current, {
        type: seg.type,
        label: seg.word,
        keys: segInput.length,
        t,
        partial: true,
        sentenceIndex: seg.sentenceIndex,
      })
    }
    flushTracker(trackerRef.current)
    // effect 内の同期 setState は次tickへ遅延（cascading renders 回避）。
    setTimeout(() => finish(keysRef.current, mistakesRef.current, t, startTime), 0)
  }, [finished, now, startTime, segments, segIndex, segInput, finish])

  return {
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    word: segments[segIndex]?.word, // 現在セグの見出し語
    finished,
    result,
    records,
    restart,
  }
}
