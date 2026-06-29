// 単語の4択クイズの状態機械。選択肢を「打って」選ぶ。最初の打鍵から60秒で終了。
// 問題が尽きたら再シャッフルで継ぎ足し、60秒の間ずっと出題する。スコアはタイピング数(typedKeys)。
// dir='en'(英語訳: 和訳→英単語) / 'ja'(日本語訳: 英単語→和訳をローマ字)
import { useCallback, useEffect, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet, levelWords, makeQuiz } from '../domain/words/wordset.js'
import { mulberry32 } from '../domain/rng.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { loadWordRecords, saveWordRecord } from './records.js'
import { makeSeed } from './seed.js'

export function useWordQuiz({ words, level, theme, dir, mode, seed, onExit }) {
  // 「今プレイ中の問題列・選択肢」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに切り直し、record には必ずこの seed を保存して再現可能にする。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  const buildWith = useCallback(
    (s) => {
      const opts = { rng: mulberry32(s) }
      return makeQuiz(buildWordSet(words, level, theme, WORD_COUNT, opts), levelWords(words, level), dir, 4, opts)
    },
    [words, level, theme, dir],
  )
  const [questions, setQuestions] = useState(() => buildWith(sessionSeed))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [picked, setPicked] = useState(null) // 確定した選択肢(option) or null
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0) // タイプミス
  const [typedKeys, setTypedKeys] = useState(0) // タイピング数（選択肢を打った文字数の合計）
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const [startTime, setStartTime] = useState(null)
  const segStatsRef = useRef([]) // 今回プレイの問題ごとの記録（設問の正誤）
  const perQMissRef = useRef(0) // 現在の設問のタイプミス数
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード
  const keysRef = useRef(0) // 時間切れ finish 用の最新タイピング数
  const correctRef = useRef(0) // 時間切れ finish 用の最新正解数
  const mistakesRef = useRef(0) // 時間切れ finish 用の最新ミス数

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
    setTypedKeys(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
    finishedRef.current = false
    keysRef.current = 0
    correctRef.current = 0
    mistakesRef.current = 0
  }, [buildWith])

  const finish = useCallback(
    (keys, correctCount, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const seconds = Math.round((endTime - startedAt) / 100) / 10
      const total = segStatsRef.current.length // 60秒で完答した設問数
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const minutes = (endTime - startedAt) / 60000
      const speed = minutes > 0 ? Math.round(keys / minutes) : 0
      const record = {
        source: 'word', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        level,
        theme,
        mode,
        keys, // タイピング数（主指標）
        speed,
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
    [level, theme, mode, sessionSeed],
  )

  const commit = useCallback(
    (option, typed = 0) => {
      const _t = performance.now()
      setStartTime((p) => p ?? _t)
      setPicked(option)
      if (typed > 0) setTypedKeys((k) => (keysRef.current = k + typed)) // 打って選んだ分のタイピング数
      if (option.answer) setCorrect((c) => (correctRef.current = c + 1))
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
    // 60秒制：問題が尽きたら再シャッフルで継ぎ足し、ずっと出題し続ける。
    if (index >= questions.length - 1) {
      setQuestions((prev) => [...prev, ...buildWith(makeSeed())])
    }
    setIndex((i) => i + 1)
    setInput('')
    setPicked(null)
    setHasError(false)
  }, [picked, index, questions, buildWith])

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
        if (hit) commit(hit, candidate.length) // 打って選んだ＝candidate長をタイピング数に加算
      } else {
        setMistakes((m) => (mistakesRef.current = m + 1))
        perQMissRef.current += 1
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, picked, q, input, advance, restart, onExit, commit])

  // 最初の打鍵から60秒で終了（操作が無くても時間で finish）。
  const onTimeout = (endTime, startedAt) =>
    finish(keysRef.current, correctRef.current, mistakesRef.current, endTime, startedAt)
  const { elapsedSec } = useCountdownTimer({ active: !finished, startTime, onTimeout })

  return {
    question: q,
    index,
    input,
    hasError,
    picked,
    correct,
    mistakes,
    typedKeys,
    elapsedSec,
    finished,
    result,
    records,
    pick,
    advance,
    restart,
  }
}
