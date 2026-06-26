// 英英辞典の入力モード（英語入力=定義文を打つ / 日本語入力=和訳を打つ）。N語で終了。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DICT_TYPE_COUNT, buildDictSet } from '../domain/dictionary/dictset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { score } from '../domain/marathon/scoring.js'
import { mulberry32 } from '../domain/rng.js'
import { loadDictRecords, saveDictRecord } from '../infrastructure/dictRepository.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { newSegTracker, segMark, segMiss, segPush } from './segTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'
import { makeSeed } from './seed.js'

export function useDict({ dict, level, theme, mode, seed, onExit }) {
  // 「今プレイ中の見出し語列」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに切り直し、record には必ずこの seed を保存して再現可能にする。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  const build = useCallback(
    () => buildDictSet(dict, level, theme, DICT_TYPE_COUNT, { rng: mulberry32(sessionSeed) }),
    [dict, level, theme, sessionSeed],
  )
  const [entries, setEntries] = useState(build)
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadDictRecords())
  const [startTime, setStartTime] = useState(null)
  const trackerRef = useRef(newTracker()) // 見出し語ごとの累積記録
  const segTrackerRef = useRef(newSegTracker()) // 今回プレイの問題ごとの記録

  const entry = entries[index]
  // 定義(en=def)/和訳(ja) を buildUnits 用に渡してセグメント化
  const seg = useMemo(
    () => buildUnits({ en: entry.def, ja: entry.ja, kana: entry.kana }, mode)[0],
    [entry, mode],
  )

  const restart = useCallback(() => {
    flushTracker(trackerRef.current)
    segTrackerRef.current = newSegTracker()
    // 「もう一度」は毎回新しい問題列にする＝新しい seed を切り直して record にも反映。
    const next = makeSeed()
    setSessionSeed(next)
    setEntries(buildDictSet(dict, level, theme, DICT_TYPE_COUNT, { rng: mulberry32(next) }))
    setIndex(0)
    setInput('')
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
  }, [dict, level, theme])

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
    (keys, totalMistakes, endTime) => {
      const elapsedMs = endTime - startTime
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const record = {
        source: 'dict', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        level,
        theme,
        mode,
        speed,
        keys,
        words: entries.length,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        segStats: segTrackerRef.current.list,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, sessionSeed, entries.length, startTime],
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

      const candidate = input + e.key
      if (segMatches(seg, candidate)) {
        const t = performance.now()
        setStartTime((p) => p ?? t)
        setHasError(false)
        segMark(segTrackerRef.current, t) // この見出し語の最初の打鍵時刻
        trackKey(trackerRef.current, itemId('d', mode, entry.word)) // 見出し語ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        if (seg.variants.includes(candidate)) {
          // 見出し語1件の完了を「問題ごとの記録」に積む
          segPush(segTrackerRef.current, {
            type: seg.type,
            label: entry.word,
            keys: candidate.length,
            t,
          })
          if (index >= entries.length - 1) {
            flushTracker(trackerRef.current)
            finish(newKeys, mistakes, t)
          } else {
            setIndex((i) => i + 1)
            setInput('')
          }
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
  }, [finished, seg, entry, index, entries.length, input, typedKeys, mistakes, mode, onExit, restart, finish])

  return {
    entry,
    seg,
    index,
    input,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    total: entries.length,
    finished,
    result,
    records,
    restart,
  }
}
