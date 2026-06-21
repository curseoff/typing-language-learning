// 単語の4択クイズの状態機械。選択肢を「打って」選ぶ。30問で終了。
// dir='en'(英語訳: 和訳→英単語) / 'ja'(日本語訳: 英単語→和訳をローマ字)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet, levelWords, makeQuiz } from '../domain/words/wordset.js'
import { loadWordRecords, saveWordRecord } from '../infrastructure/wordsRepository.js'

export function useWordQuiz({ level, theme, dir, mode, onExit }) {
  const [questions, setQuestions] = useState(() =>
    makeQuiz(buildWordSet(level, theme), levelWords(level), dir),
  )
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [picked, setPicked] = useState(null) // 確定した選択肢(option) or null
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0) // タイプミス
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const startTimeRef = useRef(null)

  const q = questions[index]

  const restart = useCallback(() => {
    setQuestions(makeQuiz(buildWordSet(level, theme), levelWords(level), dir))
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
  }, [level, theme, dir])

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
        mode,
        correct: correctCount,
        words: total,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, questions.length],
  )

  const commit = useCallback(
    (option) => {
      if (startTimeRef.current === null) startTimeRef.current = performance.now()
      setPicked(option)
      if (option.answer) setCorrect((c) => c + 1)
    },
    [],
  )

  // クリックで選択
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
        setInput((prev) => prev.slice(0, -1))
        setHasError(false)
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      const candidate = input + e.key
      const canType = q.options.some((o) => o.variants.some((v) => v.startsWith(candidate)))
      if (canType) {
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
    finished,
    result,
    records,
    total: WORD_COUNT,
    pick,
    advance,
    restart,
  }
}
