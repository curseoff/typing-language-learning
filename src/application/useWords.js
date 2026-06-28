// 単語の入力モード（英語/日本語/英語・日本語）の状態機械。最初の打鍵から60秒で終了。
// both は1語ごとに英語→その日本語を続けて入力する。語が尽きたら継ぎ足してループする。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildWordPassage } from '../domain/words/wordset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { score } from '../domain/marathon/scoring.js'
import { mulberry32 } from '../domain/rng.js'
import { loadWordRecords, saveWordRecord } from './records.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { newSegTracker, segMark, segMiss, segPush } from './segTracker.js'
import { itemId } from '../infrastructure/itemStatsRepository.js'
import { makeSeed } from './seed.js'

export function useWords({ allWords, level, theme, mode, seed, onExit }) {
  // 「今プレイ中の問題列」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに新しい seed を切り直す（＝View 内「もう一度」は別の問題列）。
  // この seed を record に必ず保存することで、通常プレイの記録も再現可能になる。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  const buildPassage = useCallback(
    () => buildWordPassage(allWords, level, theme, mode, { rng: mulberry32(sessionSeed) }),
    [allWords, level, theme, mode, sessionSeed],
  )
  const [words, setWords] = useState(buildPassage)
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
  const [startTime, setStartTime] = useState(null)
  const trackerRef = useRef(newTracker()) // 単語ごとの累積記録
  const segTrackerRef = useRef(newSegTracker()) // 今回プレイの問題ごとの記録
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード
  const timeUpRef = useRef(false) // 時間切れ処理を一度だけ行うガード
  const keysRef = useRef(0) // 時間切れ finish 用の最新打鍵数
  const mistakesRef = useRef(0) // 時間切れ finish 用の最新ミス数

  // 文章と同じUI(TopFlow/Passage)で使うため sentenceIndex(=語のindex) を付与。
  const segments = useMemo(
    () => words.flatMap((w, wi) => buildUnits(w, mode).map((s) => ({ ...s, sentenceIndex: wi }))),
    [words, mode],
  )
  const seg = segments[segIndex]
  // 進捗バーは経過時間（0→60秒）で表す
  const progress = Math.min(1, startTime !== null && now ? (now - startTime) / TIME_LIMIT_MS : 0)

  const restart = useCallback(() => {
    flushTracker(trackerRef.current)
    segTrackerRef.current = newSegTracker()
    // 「もう一度」は毎回新しい問題列にする＝新しい seed を切り直して record にも反映。
    const next = makeSeed()
    setSessionSeed(next)
    setWords(buildWordPassage(allWords, level, theme, mode, { rng: mulberry32(next) }))
    setSegIndex(0)
    setInput('')
    setCompleted([])
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
    finishedRef.current = false
    timeUpRef.current = false
    keysRef.current = 0
    mistakesRef.current = 0
  }, [allWords, level, theme, mode])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [finished])

  const started = startTime !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const min = (now - startTime) / 60000
    return min > 0 ? Math.round(typedKeys / min) : 0
  }, [now, typedKeys, started, startTime])
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTime) / 100) / 10
  }, [now, started, startTime])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const record = {
        source: 'word', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        level,
        theme,
        mode,
        speed,
        keys,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        segStats: segTrackerRef.current.list,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, sessionSeed],
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
      if (!seg || finishedRef.current) return

      const candidate = input + e.key
      if (segMatches(seg, candidate)) {
        const t = performance.now()
        setStartTime((p) => p ?? t)
        setHasError(false)
        segMark(segTrackerRef.current, t) // この語の最初の打鍵時刻
        trackKey(trackerRef.current, itemId('w', mode, seg.en)) // 単語ごと×モード別
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        keysRef.current = newKeys

        const completesSeg = seg.variants.includes(candidate)
        // 語の完了で「問題ごとの記録」を1件積む（未完は60秒 finish 側で処理）
        if (completesSeg) {
          segPush(segTrackerRef.current, {
            type: seg.type,
            label: seg.type === 'en' ? seg.en : seg.ja,
            keys: candidate.length,
            t,
            partial: false,
          })
          // 語を打ち尽くしたら同じ seed で継ぎ足してループ（60秒の間ずっと続ける）。
          if (segIndex + 1 >= segments.length) {
            setWords((prev) => [
              ...prev,
              ...buildWordPassage(allWords, level, theme, mode, { rng: mulberry32(makeSeed()) }),
            ])
          }
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setInput('')
        } else {
          setInput(candidate)
        }
      } else {
        setMistakes((m) => {
          mistakesRef.current = m + 1
          return m + 1
        })
        trackMiss(trackerRef.current)
        segMiss(segTrackerRef.current)
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, seg, segIndex, segments.length, input, typedKeys, mode, allWords, level, theme, onExit, restart, finish])

  // 最初の打鍵から60秒で終了（キー入力が無くても時間で finish）。
  // 現在入力中の語があれば partial として記録に積んでから finish。
  useEffect(() => {
    if (finished || startTime === null || timeUpRef.current) return
    if (now - startTime < TIME_LIMIT_MS) return
    timeUpRef.current = true // partial 記録と finish 予約は一度だけ
    const t = startTime + TIME_LIMIT_MS
    if (seg && input.length > 0) {
      segPush(segTrackerRef.current, {
        type: seg.type,
        label: seg.type === 'en' ? seg.en : seg.ja,
        keys: input.length,
        t,
        partial: true,
      })
    }
    flushTracker(trackerRef.current)
    // effect 内の同期 setState（finish→setRecords/setResult/setFinished）は次tickへ遅延。
    setTimeout(() => finish(keysRef.current, mistakesRef.current, t, startTime), 0)
  }, [finished, now, startTime, seg, input, finish])

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
    finished,
    result,
    records,
    restart,
  }
}
