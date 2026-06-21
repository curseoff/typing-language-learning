// 単語問題の状態機械（和訳→英単語、N語で終了）。WordsView 内で呼ぶ前提。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet } from '../domain/words/wordset.js'
import { score } from '../domain/marathon/scoring.js'
import { loadWordRecords, saveWordRecord, wordRecKey } from '../infrastructure/wordsRepository.js'

export function useWords({ level, theme, onExit }) {
  const [words, setWords] = useState(() => buildWordSet(level, theme))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const startTimeRef = useRef(null)

  const restart = useCallback(() => {
    setWords(buildWordSet(level, theme))
    setIndex(0)
    setInput('')
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    startTimeRef.current = null
  }, [level, theme])

  // 経過時間（終了後は止める）
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
    [level, theme, words.length],
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

      const target = words[index].en
      const candidate = input + e.key
      if (target.startsWith(candidate)) {
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        if (candidate === target) {
          // 単語完了
          if (index >= words.length - 1) {
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
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, words, index, input, typedKeys, mistakes, onExit, restart, finish])

  return {
    words,
    index,
    input,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    finished,
    result,
    records,
    total: WORD_COUNT,
    restart,
  }
}
