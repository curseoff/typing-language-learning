// 単語の入力モード（英語/日本語/英語・日本語）の状態機械。30語で終了。
// both は日常会話と同じく、1語ごとに英語→その日本語を続けて入力する。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet } from '../domain/words/wordset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { score } from '../domain/marathon/scoring.js'
import { loadWordRecords, saveWordRecord } from '../infrastructure/wordsRepository.js'

export function useWords({ level, theme, mode, onExit }) {
  const [words, setWords] = useState(() => buildWordSet(level, theme))
  const [segIndex, setSegIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const startTimeRef = useRef(null)

  // 1語あたり: en/ja=1セグメント、both=英→日の2セグメント（日常会話と同じ）
  const segments = useMemo(() => words.flatMap((w) => buildUnits(w, mode)), [words, mode])
  const segsPerWord = mode === 'both' ? 2 : 1
  const seg = segments[segIndex]
  const wordsDone = Math.floor(segIndex / segsPerWord)
  const progress = segments.length ? segIndex / segments.length : 0

  const restart = useCallback(() => {
    setWords(buildWordSet(level, theme))
    setSegIndex(0)
    setInput('')
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    startTimeRef.current = null
  }, [level, theme])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [finished])

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

  const finish = useCallback(
    (keys, totalMistakes, endTime) => {
      const elapsedMs = endTime - startTimeRef.current
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const record = {
        level,
        theme,
        mode,
        speed,
        keys,
        words: words.length,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, words.length],
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
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        if (seg.variants.includes(candidate)) {
          // セグメント完了
          if (segIndex >= segments.length - 1) {
            finish(newKeys, mistakes, performance.now())
          } else {
            setSegIndex((i) => i + 1)
            setInput('')
          }
        } else {
          setInput(candidate)
        }
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, seg, segIndex, segments.length, input, typedKeys, mistakes, onExit, restart, finish])

  return {
    seg,
    input,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    wordsDone,
    progress,
    finished,
    result,
    records,
    total: WORD_COUNT,
    restart,
  }
}
