// 英英辞典の4択。英語の定義を見て、4つの英単語から正解を「打って」選ぶ。回答後に和訳を開示。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DICT_QUIZ_COUNT,
  buildDictSet,
  levelEntries,
  makeDictQuiz,
} from '../domain/dictionary/dictset.js'
import { loadDictRecords, saveDictRecord } from '../infrastructure/dictRepository.js'

export function useDictQuiz({ level, theme, onExit }) {
  const build = () => makeDictQuiz(buildDictSet(level, theme, DICT_QUIZ_COUNT), levelEntries(level))
  const [questions, setQuestions] = useState(build)
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [picked, setPicked] = useState(null)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadDictRecords())
  const startTimeRef = useRef(null)

  const q = questions[index]

  const restart = useCallback(() => {
    setQuestions(makeDictQuiz(buildDictSet(level, theme, DICT_QUIZ_COUNT), levelEntries(level)))
    setIndex(0)
    setInput('')
    setHasError(false)
    setPicked(null)
    setCorrect(0)
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
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTimeRef.current) / 100) / 10
  }, [now, started])

  const finish = useCallback(
    (correctCount, totalMistakes, endTime) => {
      const seconds = Math.round((endTime - startTimeRef.current) / 100) / 10
      const total = questions.length
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const record = {
        level,
        theme,
        mode: 'quiz',
        correct: correctCount,
        words: total,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, questions.length],
  )

  const commit = useCallback((option) => {
    if (startTimeRef.current === null) startTimeRef.current = performance.now()
    setPicked(option)
    if (option.answer) setCorrect((c) => c + 1)
  }, [])

  const pick = useCallback(
    (option) => {
      if (finished || picked !== null) return
      commit(option)
    },
    [finished, picked, commit],
  )

  const advance = useCallback(() => {
    if (picked === null) return
    if (index >= questions.length - 1) {
      finish(correct, mistakes, performance.now())
    } else {
      setIndex((i) => i + 1)
      setInput('')
      setPicked(null)
      setHasError(false)
    }
  }, [picked, index, questions.length, finish, correct, mistakes])

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
      if (picked !== null) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          advance()
        }
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setInput((p) => p.slice(0, -1))
        setHasError(false)
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const candidate = input + e.key
      if (q.options.some((o) => o.variants.some((v) => v.startsWith(candidate)))) {
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        setInput(candidate)
        const hit = q.options.find((o) => o.variants.includes(candidate))
        if (hit) commit(hit)
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, picked, q, input, advance, restart, onExit, commit])

  return {
    question: q,
    index,
    input,
    hasError,
    picked,
    correct,
    mistakes,
    elapsedSec,
    total: DICT_QUIZ_COUNT,
    finished,
    result,
    records,
    pick,
    advance,
    restart,
  }
}
