// 単語の4択クイズの状態機械。選択肢を「打って」選ぶ。30問で終了。
// dir='en'(英語訳: 和訳→英単語) / 'ja'(日本語訳: 英単語→和訳をローマ字)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet, levelWords, makeQuiz } from '../domain/words/wordset.js'
import { mulberry32 } from '../domain/rng.js'
import { loadWordRecords, saveWordRecord } from '../infrastructure/wordsRepository.js'

export function useWordQuiz({ words, level, theme, dir, mode, seed, onExit }) {
  // seed があれば決定的な問題列・選択肢を再現（リプレイ）。無ければ domain 既定の Math.random。
  const build = useCallback(() => {
    const opts = seed != null ? { rng: mulberry32(seed) } : {}
    return makeQuiz(buildWordSet(words, level, theme, WORD_COUNT, opts), levelWords(words, level), dir, 4, opts)
  }, [words, level, theme, dir, seed])
  const [questions, setQuestions] = useState(build)
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
  const [startTime, setStartTime] = useState(null)
  const segStatsRef = useRef([]) // 今回プレイの問題ごとの記録（設問の正誤）
  const perQMissRef = useRef(0) // 現在の設問のタイプミス数

  const q = questions[index]

  const restart = useCallback(() => {
    segStatsRef.current = []
    perQMissRef.current = 0
    setQuestions(build())
    setIndex(0)
    setInput('')
    setHasError(false)
    setPicked(null)
    setCorrect(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
  }, [build])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [finished])

  const started = startTime !== null
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTime) / 100) / 10
  }, [now, started, startTime])

  const finish = useCallback(
    (correctCount, totalMistakes, endTime) => {
      const seconds = Math.round((endTime - startTime) / 100) / 10
      const total = questions.length
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const record = {
        source: 'word', // リプレイの分岐用（App.replay）
        seed, // 同じ問題列を再現するためのシード（リプレイ用）
        level,
        theme,
        mode,
        correct: correctCount,
        words: total,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        segStats: segStatsRef.current,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, seed, questions.length, startTime],
  )

  const commit = useCallback(
    (option) => {
      const _t = performance.now()
      setStartTime((p) => p ?? _t)
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
    // 現在の設問の結果（問題・正誤・ミス）を「問題ごとの記録」に積む
    const cur = questions[index]
    segStatsRef.current = [
      ...segStatsRef.current,
      {
        no: segStatsRef.current.length + 1,
        label: cur.prompt,
        answer: cur.answerDisplay,
        correct: !!picked.answer,
        mistakes: perQMissRef.current,
      },
    ]
    perQMissRef.current = 0
    if (index >= questions.length - 1) {
      finish(correct, mistakes, performance.now())
    } else {
      setIndex((i) => i + 1)
      setInput('')
      setPicked(null)
      setHasError(false)
    }
  }, [picked, index, questions, finish, correct, mistakes])

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
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        setInput(candidate)
        const hit = q.options.find((o) => o.variants.includes(candidate))
        if (hit) commit(hit)
      } else {
        setMistakes((m) => m + 1)
        perQMissRef.current += 1
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
