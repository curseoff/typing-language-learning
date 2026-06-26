// 単語の入力モード（英語/日本語/英語・日本語）の状態機械。600文字で終了（マラソンと同じ）。
// both は1語ごとに英語→その日本語を続けて入力する。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildWordPassage } from '../domain/words/wordset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { TARGET_KEYS } from '../domain/marathon/passage.js'
import { score } from '../domain/marathon/scoring.js'
import { mulberry32 } from '../domain/rng.js'
import { loadWordRecords, saveWordRecord } from '../infrastructure/wordsRepository.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { newSegTracker, segMark, segMiss, segPush } from './segTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'

export function useWords({ allWords, level, theme, mode, seed, onExit }) {
  // seed があれば決定的な問題列を再現（リプレイ）。同じ seed なら restart も同じ列になる。
  // seed 無し（フック単体や旧経路）は Math.random で従来どおりランダム出題。
  const buildPassage = useCallback(
    () => buildWordPassage(allWords, level, theme, mode, seed != null ? { rng: mulberry32(seed) } : {}),
    [allWords, level, theme, mode, seed],
  )
  const [words, setWords] = useState(buildPassage)
  const [segIndex, setSegIndex] = useState(0)
  const [input, setInput] = useState('')
  const [completed, setCompleted] = useState([])
  const [hasError, setHasError] = useState(false)
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const [startTime, setStartTime] = useState(null)
  const trackerRef = useRef(newTracker()) // 単語ごとの累積記録
  const segTrackerRef = useRef(newSegTracker()) // 今回プレイの問題ごとの記録

  // 文章と同じUI(TopFlow/Passage)で使うため sentenceIndex(=語のindex) を付与。
  const segments = useMemo(
    () => words.flatMap((w, wi) => buildUnits(w, mode).map((s) => ({ ...s, sentenceIndex: wi }))),
    [words, mode],
  )
  const seg = segments[segIndex]
  const progress = Math.min(1, typedKeys / TARGET_KEYS)

  const restart = useCallback(() => {
    flushTracker(trackerRef.current)
    segTrackerRef.current = newSegTracker()
    setWords(buildPassage())
    setSegIndex(0)
    setInput('')
    setCompleted([])
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
  }, [buildPassage])

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
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const record = {
        source: 'word', // リプレイの分岐用（App.replay）
        seed, // 同じ問題列を再現するためのシード（リプレイ用）
        level,
        theme,
        mode,
        speed,
        keys,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        segStats: segTrackerRef.current.list,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, seed],
  )

  useEffect(() => {
    const onKey = (e) => {
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
      if (!seg) return

      const candidate = input + e.key
      if (segMatches(seg, candidate)) {
        const t = performance.now()
        const startedAt = startTime ?? t // この打鍵で開始した場合も正しい開始時刻を使う
        setStartTime((p) => p ?? t)
        setHasError(false)
        segMark(segTrackerRef.current, t) // この語の最初の打鍵時刻
        trackKey(trackerRef.current, itemId('w', mode, seg.en)) // 単語ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)

        const completesSeg = seg.variants.includes(candidate)
        const reachedGoal = newKeys >= TARGET_KEYS
        // 語の完了 or 打ち切りで「問題ごとの記録」を1件積む
        if (completesSeg || reachedGoal) {
          segPush(segTrackerRef.current, {
            type: seg.type,
            label: seg.type === 'en' ? seg.en : seg.ja,
            keys: candidate.length,
            t,
            partial: !completesSeg,
          })
        }

        if (reachedGoal) {
          flushTracker(trackerRef.current)
          finish(newKeys, mistakes, t, startedAt)
          return
        }
        if (completesSeg) {
          // 単語を打ち尽くした場合は終了（600未満でも詰まないように）
          if (segIndex + 1 >= segments.length) {
            flushTracker(trackerRef.current)
            finish(newKeys, mistakes, t, startedAt)
            return
          }
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setInput('')
        } else {
          setInput(candidate)
        }
      } else {
        setMistakes((m) => m + 1)
        trackMiss(trackerRef.current)
        segMiss(segTrackerRef.current)
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, seg, segIndex, segments.length, input, typedKeys, mistakes, mode, startTime, onExit, restart, finish])

  return {
    segments,
    segIndex,
    segInput: input,
    completed,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    progress,
    target: TARGET_KEYS,
    finished,
    result,
    records,
    restart,
  }
}
