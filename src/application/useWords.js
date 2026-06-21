// 単語の入力モード（英語/日本語/英語・日本語）の状態機械。600文字で終了（マラソンと同じ）。
// both は1語ごとに英語→その日本語を続けて入力する。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildWordPassage } from '../domain/words/wordset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { TARGET_KEYS } from '../domain/marathon/passage.js'
import { score } from '../domain/marathon/scoring.js'
import { loadWordRecords, saveWordRecord } from '../infrastructure/wordsRepository.js'

export function useWords({ level, theme, mode, onExit }) {
  const [words, setWords] = useState(() => buildWordPassage(level, theme, mode))
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
  const startTimeRef = useRef(null)

  // 文章と同じUI(TopFlow/Passage)で使うため sentenceIndex(=語のindex) を付与。
  const segments = useMemo(
    () => words.flatMap((w, wi) => buildUnits(w, mode).map((s) => ({ ...s, sentenceIndex: wi }))),
    [words, mode],
  )
  const seg = segments[segIndex]
  const progress = Math.min(1, typedKeys / TARGET_KEYS)

  const restart = useCallback(() => {
    setWords(buildWordPassage(level, theme, mode))
    setSegIndex(0)
    setInput('')
    setCompleted([])
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    startTimeRef.current = null
  }, [level, theme, mode])

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
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode],
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
        if (startTimeRef.current === null) startTimeRef.current = t
        setHasError(false)
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)

        if (newKeys >= TARGET_KEYS) {
          finish(newKeys, mistakes, t)
          return
        }
        if (seg.variants.includes(candidate)) {
          // 単語を打ち尽くした場合は終了（600未満でも詰まないように）
          if (segIndex + 1 >= segments.length) {
            finish(newKeys, mistakes, t)
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
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, seg, segIndex, segments.length, input, typedKeys, mistakes, onExit, restart, finish])

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
