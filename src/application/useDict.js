// 英英辞典の入力モード（英語入力=定義文を打つ / 日本語入力=和訳を打つ）。N語で終了。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DICT_TYPE_COUNT, buildDictSet } from '../domain/dictionary/dictset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { score } from '../domain/marathon/scoring.js'
import { loadDictRecords, saveDictRecord } from '../infrastructure/dictRepository.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'

export function useDict({ level, theme, mode, onExit }) {
  const [entries, setEntries] = useState(() => buildDictSet(level, theme, DICT_TYPE_COUNT))
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

  const entry = entries[index]
  // 定義(en=def)/和訳(ja) を buildUnits 用に渡してセグメント化
  const seg = useMemo(
    () => buildUnits({ en: entry.def, ja: entry.ja, kana: entry.kana }, mode)[0],
    [entry, mode],
  )

  const restart = useCallback(() => {
    flushTracker(trackerRef.current)
    setEntries(buildDictSet(level, theme, DICT_TYPE_COUNT))
    setIndex(0)
    setInput('')
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
  }, [level, theme])

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
        level,
        theme,
        mode,
        speed,
        keys,
        words: entries.length,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, entries.length, startTime],
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
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        trackKey(trackerRef.current, itemId('d', mode, entry.word)) // 見出し語ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        if (seg.variants.includes(candidate)) {
          if (index >= entries.length - 1) {
            flushTracker(trackerRef.current)
            finish(newKeys, mistakes, performance.now())
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
