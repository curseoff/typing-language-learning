// 単語の4択クイズの状態機械。選択肢を「打って」選ぶ。最初の打鍵から60秒で終了。
// 問題が尽きたら再シャッフルで継ぎ足し、60秒の間ずっと出題する。スコアはタイピング数(typedKeys)。
// dir='en'(英語訳: 和訳→英単語) / 'ja'(日本語訳: 英単語→和訳をローマ字)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORD_COUNT, buildWordSet, levelWords, makeQuiz } from '../domain/words/wordset.js'
import { mulberry32 } from '../domain/rng.js'
import { normalizeEndCondition, endLimitMs, shouldFinish } from '../domain/session/endCondition.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { loadWordRecords, saveWordRecord } from './records.js'
import { buildQuizSegStat } from './quizSegStat.js'
import { makeSeed } from './seed.js'
import { playMiss } from '../infrastructure/sound.js'
import { END_TIME_VALUES } from '../content/endConditions.js'

// エンドレスを ESC で記録するのに必要な最低プレイ時間（30秒＝時間制の最短値）。#208 段6
const ENDLESS_MIN_RECORD_MS = END_TIME_VALUES[0] * 1000

// endCondition 未指定は既定 time60（＝従来の60秒制・従来キー）。
export function useWordQuiz({ words, level, theme, dir, mode, seed, endCondition, onExit }) {
  // 参照を安定させ、finish/タイマーの無用な再生成を避ける（endCondition は親が安定参照で渡す）。
  const ec = useMemo(() => normalizeEndCondition(endCondition), [endCondition])
  const limitMs = endLimitMs(ec)
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
  const [missedItems, setMissedItems] = useState(0) // ミスした設問数（life 制HUD用の live 値）
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
  const startTimeRef = useRef(null) // 進捗 finish 用の開始時刻（startTime と同値）

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
    setMissedItems(0)
    setTypedKeys(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
    finishedRef.current = false
    keysRef.current = 0
    correctRef.current = 0
    mistakesRef.current = 0
    startTimeRef.current = null
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
      // 一発正解数（items 制の主指標）＝正答かつミス0の設問数。#208 段3a
      const noMissCorrect = segStatsRef.current.filter(
        (s) => s.correct && (s.mistakes ?? 0) === 0,
      ).length
      const record = {
        source: 'word', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        endCondition: ec, // 終了条件（正規化済み・記録キーの分岐用。#208 段1a）
        level,
        theme,
        mode,
        keys, // タイピング数（主指標）
        speed,
        correct: correctCount,
        correctCount: noMissCorrect,
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
    [level, theme, mode, sessionSeed, ec],
  )

  // 進捗（タイピング数/設問数/ミス数）が終了条件に達したら finish（chars/items/life＝時間制以外）。
  // 時間制は elapsedMs が制限に届くまで false のまま＝従来どおりタイマーが終了を担う。
  // クイズは完答した設問のみ segStats に積む方針なので、未確定設問の partial 記録はしない。
  const finishByProgress = useCallback(
    (t) => {
      if (finishedRef.current) return
      const startedAt = startTimeRef.current ?? t
      const items = segStatsRef.current.length
      // life は「ミスした設問数」で判定（打鍵ミス総数ではない・#208 段5）。
      // 確定設問のミス>0件数＋現在設問が既にミス済みなら+1（設問単位）。
      const missedItems =
        segStatsRef.current.filter((s) => (s.mistakes ?? 0) > 0).length +
        (perQMissRef.current > 0 ? 1 : 0)
      if (!shouldFinish(ec, { elapsedMs: t - startedAt, keys: keysRef.current, items, missedItems })) return
      finish(keysRef.current, correctRef.current, mistakesRef.current, t, startedAt)
    },
    [ec, finish],
  )

  const commit = useCallback(
    (option, typed = 0) => {
      const _t = performance.now()
      setStartTime((p) => p ?? _t)
      startTimeRef.current = startTimeRef.current ?? _t // 進捗 finish 用
      setPicked(option)
      if (typed > 0) setTypedKeys((k) => (keysRef.current = k + typed)) // 打って選んだ分のタイピング数
      if (option.answer) setCorrect((c) => (correctRef.current = c + 1))
      // タイピング数（chars 制）の到達を判定。
      finishByProgress(_t)
    },
    [finishByProgress],
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
    // 現在の設問の結果（問題・正誤・ミス・選んだ選択肢の英日）を「問題ごとの記録」に積む
    const cur = questions[index]
    segStatsRef.current = [
      ...segStatsRef.current,
      buildQuizSegStat({
        question: cur,
        picked,
        no: segStatsRef.current.length + 1,
        mistakes: perQMissRef.current,
      }),
    ]
    perQMissRef.current = 0
    // 設問数（items 制）の到達を判定（1問完答した直後）。
    finishByProgress(performance.now())
    if (finishedRef.current) return
    // 60秒制：問題が尽きたら再シャッフルで継ぎ足し、ずっと出題し続ける。
    if (index >= questions.length - 1) {
      setQuestions((prev) => [...prev, ...buildWith(makeSeed())])
    }
    setIndex((i) => i + 1)
    setInput('')
    setPicked(null)
    setHasError(false)
  }, [picked, index, questions, buildWith, finishByProgress])

  // エンドレスは ESC が唯一の終了手段。30秒以上プレイしていれば記録して結果へ、
  // それ未満（未打鍵で startTime 未確定なら経過0扱い）は中断＝onExit（#208 段6）。
  const finishByEsc = useCallback(() => {
    if (finishedRef.current) return false
    const t = performance.now()
    const startedAt = startTimeRef.current ?? t
    if (t - startedAt < ENDLESS_MIN_RECORD_MS) return false
    finish(keysRef.current, correctRef.current, mistakesRef.current, t, startedAt)
    return true
  }, [finish])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (ec.kind === 'endless' && !finished && finishByEsc()) return
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
        // ミスした設問数を live 更新（life 制HUD用）＝確定設問のミス>0件数＋現在設問が既ミスなら+1。
        setMissedItems(
          segStatsRef.current.filter((s) => (s.mistakes ?? 0) > 0).length +
            (perQMissRef.current > 0 ? 1 : 0),
        )
        playMiss()
        setHasError(true)
        // ミス数（life 制）の到達を判定。
        finishByProgress(performance.now())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, picked, q, input, advance, restart, onExit, commit, finishByProgress, ec, finishByEsc])

  // 最初の打鍵から60秒で終了（操作が無くても時間で finish）。
  const onTimeout = (endTime, startedAt) =>
    finish(keysRef.current, correctRef.current, mistakesRef.current, endTime, startedAt)
  const { elapsedSec } = useCountdownTimer({ active: !finished, startTime, onTimeout, limitMs })

  return {
    question: q,
    index,
    input,
    hasError,
    picked,
    correct,
    mistakes,
    missedItems,
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
