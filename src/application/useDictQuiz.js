// 英英辞典の選択式（打って選ぶ）。
// kind='quiz': 定義→英単語4択（回答後に和訳開示） / kind='pick': 単語+和訳→説明文4択
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DICT_QUIZ_COUNT,
  DICT_TYPE_COUNT,
  buildDictSet,
  levelEntries,
  makeDictQuiz,
  makeDictPick,
} from '../domain/dictionary/dictset.js'
import { mulberry32 } from '../domain/rng.js'
import { loadDictRecords, saveDictRecord } from '../infrastructure/dictRepository.js'
import { makeSeed } from './seed.js'

export function useDictQuiz({ dict, level, theme, kind = 'quiz', seed, onExit }) {
  // 「今プレイ中の問題列・選択肢」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに切り直し、record には必ずこの seed を保存して再現可能にする。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  const buildWith = useCallback(
    (s) => {
      const opts = { rng: mulberry32(s) }
      return kind === 'pick'
        ? makeDictPick(buildDictSet(dict, level, theme, DICT_TYPE_COUNT, opts), levelEntries(dict, level), DICT_TYPE_COUNT, 4, opts)
        : makeDictQuiz(buildDictSet(dict, level, theme, DICT_QUIZ_COUNT, opts), levelEntries(dict, level), DICT_QUIZ_COUNT, 4, opts)
    },
    [dict, level, theme, kind],
  )
  const [questions, setQuestions] = useState(() => buildWith(sessionSeed))
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
  const [startTime, setStartTime] = useState(null)
  const segStatsRef = useRef([]) // 今回プレイの問題ごとの記録（設問の正誤）
  const perQMissRef = useRef(0)

  const q = questions[index]

  const restart = useCallback(() => {
    segStatsRef.current = []
    perQMissRef.current = 0
    // 「もう一度」は毎回新しい問題列にする＝新しい seed を切り直して record にも反映。
    const next = makeSeed()
    setSessionSeed(next)
    setQuestions(buildWith(next))
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
  }, [buildWith])

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
        source: 'dict', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        level,
        theme,
        mode: kind,
        correct: correctCount,
        words: total,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        segStats: segStatsRef.current,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, kind, sessionSeed, questions.length, startTime],
  )

  const commit = useCallback((option) => {
    const _t = performance.now()
    setStartTime((p) => p ?? _t)
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
        setInput((p) => p.slice(0, -1))
        setHasError(false)
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const candidate = input + e.key
      if (q.options.some((o) => o.variants.some((v) => v.startsWith(candidate)))) {
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
    total: questions.length,
    finished,
    result,
    records,
    pick,
    advance,
    restart,
  }
}
