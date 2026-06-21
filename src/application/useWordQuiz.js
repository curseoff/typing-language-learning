// 単語の4択クイズの状態機械。英単語を見て、4つの和訳から正解を選ぶ。30問で終了。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet, levelWords, makeQuiz } from '../domain/words/wordset.js'
import { loadWordRecords, saveWordRecord } from '../infrastructure/wordsRepository.js'

export function useWordQuiz({ level, theme, onExit }) {
  const [questions, setQuestions] = useState(() =>
    makeQuiz(buildWordSet(level, theme), levelWords(level)),
  )
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null) // 選んだ選択肢index（未回答は null）
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const startTimeRef = useRef(null)

  const q = questions[index]

  const restart = useCallback(() => {
    setQuestions(makeQuiz(buildWordSet(level, theme), levelWords(level)))
    setIndex(0)
    setPicked(null)
    setCorrect(0)
    setWrong(0)
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
    (correctCount, endTime) => {
      const seconds = Math.round((endTime - startTimeRef.current) / 100) / 10
      const total = questions.length
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const record = {
        level,
        theme,
        mode: 'quiz',
        correct: correctCount,
        words: total,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, questions.length],
  )

  const answer = useCallback(
    (choice) => {
      if (finished || picked !== null) return
      if (startTimeRef.current === null) startTimeRef.current = performance.now()
      setPicked(choice)
      if (choice === q.correct) setCorrect((c) => c + 1)
      else setWrong((w) => w + 1)
    },
    [finished, picked, q],
  )

  const advance = useCallback(() => {
    if (picked === null) return
    const wasCorrect = picked === q.correct
    const newCorrect = correct // correct は answer 時に加算済み
    if (index >= questions.length - 1) {
      finish(newCorrect, performance.now())
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
    void wasCorrect
  }, [picked, q, correct, index, questions.length, finish])

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
      if (picked === null) {
        // 1-4 で回答
        const n = Number(e.key)
        if (n >= 1 && n <= (q?.options.length ?? 4)) {
          e.preventDefault()
          answer(n - 1)
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, picked, q, answer, advance, restart, onExit])

  return {
    question: q,
    index,
    picked,
    correct,
    wrong,
    elapsedSec,
    finished,
    result,
    records,
    total: WORD_COUNT,
    answer,
    advance,
    restart,
  }
}
