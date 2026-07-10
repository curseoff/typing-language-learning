// 単語の入力モード（英語/日本語/英語・日本語）の状態機械。最初の打鍵から制限時間で終了。
// both は1語ごとに英語→その日本語を続けて入力する。語が尽きたら継ぎ足してループする。
//
// 打鍵数(keys)とミス数(mistakes)は TypingSession Entity（domain/session）で保持する
// （#290 部分採用）。可変 Entity は render 中に読めない（react-hooks/refs）ので ref に持ち、
// 変更のたび syncSession() が像を state(snap) へ写す＝React はその state で再描画する。
// items/life・終了判定（finish/finishByProgress/finishByEsc/onTimeout・タイマー）・segTracker は
// 従来どおり（Entity の endCondition は器のダミーで、finish 判定には一切使わない）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildWordPassage } from '../domain/words/wordset.service.js'
import { buildUnits, segMatches } from '../domain/typing/units.service.js'
import { score } from '../domain/marathon/scoring.service.js'
import { mulberry32 } from '../domain/rng.service.js'
import { normalizeEndCondition, endLimitMs, shouldFinish, makeEndCondition } from '../domain/session/endCondition.vo.js'
import { createTypingSessionFactory } from '../domain/session/typingSession.factory.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { loadWordRecords, saveWordRecord } from './records.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { newSegTracker, segMark, segMiss, segPush, segMissedItems } from './segTracker.js'
import { itemId } from '../domain/records/recordKeys.service.js'
import { playMiss } from '../infrastructure/sound.js'
import { makeSeed } from './seed.js'
import { END_TIME_VALUES } from '../content/endConditions.js'

// エンドレスを ESC で記録するのに必要な最低プレイ時間（30秒＝時間制の最短値）。#208 段6
const ENDLESS_MIN_RECORD_MS = END_TIME_VALUES[0] * 1000

// application 層のモジュールカウンタで session ID を採番する（純ドメインは ID を作れない）。
let wordsSessionSeq = 0
const nextWordsId = () => `words-${++wordsSessionSeq}`

// endCondition 未指定は既定 time60（＝従来の60秒制・従来キー）。
export function useWords({ allWords, level, theme, mode, seed, endCondition, onExit }) {
  // 参照を安定させ、finish/タイマーの無用な再生成を避ける（endCondition は親が安定参照で渡す）。
  const ec = useMemo(() => normalizeEndCondition(endCondition), [endCondition])
  const limitMs = endLimitMs(ec)
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
  const [missedItems, setMissedItems] = useState(0) // ミスした問題数（life 制HUD用の live 値）
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const [startTime, setStartTime] = useState(null)
  const trackerRef = useRef(newTracker()) // 単語ごとの累積記録
  const segTrackerRef = useRef(newSegTracker()) // 今回プレイの問題ごとの記録
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード

  // 打鍵数(keys)とミス数(mistakes)を保持する可変 Entity（部分採用）。器の endCondition VO は
  // ダミー（finish 判定には使わない＝session.finish()/isFinished() は呼ばない）。Factory と VO は初回のみ生成。
  const sessionEnd = useMemo(() => makeEndCondition('time', 60), [])
  const factory = useMemo(() => createTypingSessionFactory(nextWordsId), [])
  const sessionRef = useRef(null)
  if (sessionRef.current === null) sessionRef.current = factory.start(sessionEnd)
  const [snap, setSnap] = useState({ keys: 0, mistakes: 0 })
  // ref 読みはイベント/finish 側に閉じる（render 中は ref を読まない＝react-hooks/refs 回避）。
  const syncSession = useCallback(() => {
    const p = sessionRef.current.progress()
    setSnap({ keys: p.keys, mistakes: p.mistakes })
  }, [])
  const typedKeys = snap.keys // 打鍵数（session 像由来）
  const mistakes = snap.mistakes // ミス総数（session 像由来）

  // 文章と同じUI(TopFlow/Passage)で使うため sentenceIndex(=語のindex) を付与。
  const segments = useMemo(
    () => words.flatMap((w, wi) => buildUnits(w, mode).map((s) => ({ ...s, sentenceIndex: wi }))),
    [words, mode],
  )
  const seg = segments[segIndex]

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
    // 新 session（keys/mistakes を 0 にリセット）。像も 0 へ同期する。
    sessionRef.current = factory.start(sessionEnd)
    syncSession()
    setMissedItems(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
    finishedRef.current = false
  }, [allWords, level, theme, mode, factory, sessionEnd, syncSession])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      // 一発正解数（items 制の主指標）＝完了(非partial)かつミス0の問題数。#208 段3a
      const correctCount = segTrackerRef.current.list.filter(
        (s) => !s.partial && (s.mistakes ?? 0) === 0,
      ).length
      const record = {
        source: 'word', // リプレイの分岐用（App.replay）
        seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
        endCondition: ec, // 終了条件（正規化済み・記録キーの分岐用。#208 段1a）
        level,
        theme,
        mode,
        speed,
        keys,
        mistakes: totalMistakes,
        accuracy,
        correctCount,
        seconds,
        segStats: segTrackerRef.current.list,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, sessionSeed, ec],
  )

  useEffect(() => {
    // 進捗（打鍵数/問題数/ミス数）が終了条件に達したら finish（chars/items/life＝時間制以外）。
    // 時間制は elapsedMs が制限に届くまで false のままで、従来どおりタイマーが終了を担う。
    // 現在入力中の語があれば partial として記録に積んでから finish する（時間切れと同じ扱い）。
    const finishByProgress = (t, keys, items, missCount, partialLen) => {
      if (finishedRef.current) return
      const startedAt = startTime ?? t
      // life は「ミスした問題数」で判定（打鍵ミス総数 missCount ではない）。ミス処理後に呼ばれるので
      // 現在問題のミスも segTracker に反映済み＝判定時点の確定値で数える（off-by-one 回避）。
      const missedItems = segMissedItems(segTrackerRef.current)
      if (!shouldFinish(ec, { elapsedMs: t - startedAt, keys, items, missedItems })) return
      if (seg && partialLen > 0) {
        segPush(segTrackerRef.current, {
          type: seg.type,
          label: seg.type === 'en' ? seg.en : seg.ja,
          en: seg.en,
          ja: seg.ja,
          kana: seg.kana,
          keys: partialLen,
          t,
          partial: true,
        })
      }
      flushTracker(trackerRef.current)
      finish(keys, missCount, t, startedAt)
    }
    // エンドレスは ESC が唯一の終了手段。30秒以上プレイしていれば記録して結果へ、
    // それ未満（未打鍵で startTime 未確定なら経過0扱い）は中断＝onExit（#208 段6）。
    const finishByEsc = () => {
      if (finishedRef.current) return false
      const t = performance.now()
      const startedAt = startTime ?? t
      if (t - startedAt < ENDLESS_MIN_RECORD_MS) return false
      if (seg && input.length > 0) {
        segPush(segTrackerRef.current, {
          type: seg.type,
          label: seg.type === 'en' ? seg.en : seg.ja,
          en: seg.en,
          ja: seg.ja,
          kana: seg.kana,
          keys: input.length,
          t,
          partial: true,
        })
      }
      flushTracker(trackerRef.current)
      const p = sessionRef.current.progress()
      finish(p.keys, p.mistakes, t, startedAt)
      return true
    }
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
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      if (!seg || finishedRef.current) return

      const t = performance.now()
      const candidate = input + e.key
      if (segMatches(seg, candidate)) {
        setStartTime((p) => p ?? t)
        setHasError(false)
        segMark(segTrackerRef.current, t) // この語の最初の打鍵時刻
        trackKey(trackerRef.current, itemId('w', mode, seg.en)) // 単語ごと×モード別
        sessionRef.current.registerHit() // keys++（Entity 保持）
        syncSession()

        const completesSeg = seg.variants.includes(candidate)
        // 語の完了で「問題ごとの記録」を1件積む（未完は finish 側で処理）
        if (completesSeg) {
          segPush(segTrackerRef.current, {
            type: seg.type,
            label: seg.type === 'en' ? seg.en : seg.ja,
            en: seg.en,
            ja: seg.ja,
            kana: seg.kana,
            keys: candidate.length,
            t,
            partial: false,
          })
          // 語を打ち尽くしたら同じ seed で継ぎ足してループ（時間制の間ずっと続ける）。
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
        // 正打のたびに打鍵数/問題数の到達を判定（完了語は partial 記録不要＝partialLen 0）。
        const ph = sessionRef.current.progress()
        finishByProgress(t, ph.keys, completed.length + (completesSeg ? 1 : 0), ph.mistakes, completesSeg ? 0 : candidate.length)
      } else {
        sessionRef.current.registerMiss() // mistakes++（Entity 保持）
        syncSession()
        trackMiss(trackerRef.current)
        segMiss(segTrackerRef.current)
        setMissedItems(segMissedItems(segTrackerRef.current)) // ミスした問題数を live 更新（life 制HUD用）
        playMiss()
        setHasError(true)
        // ミス数（life 制）の到達を判定。
        const pm = sessionRef.current.progress()
        finishByProgress(t, pm.keys, completed.length, pm.mistakes, input.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, seg, segIndex, segments.length, input, completed, startTime, ec, mode, allWords, level, theme, onExit, restart, finish, syncSession])

  // 最初の打鍵から制限時間で終了（キー入力が無くても時間で finish）。
  // 現在入力中の語があれば partial として記録に積んでから finish（setTimeout 遅延は timer 側）。
  const onTimeout = (endTime, startedAt) => {
    if (seg && input.length > 0) {
      segPush(segTrackerRef.current, {
        type: seg.type,
        label: seg.type === 'en' ? seg.en : seg.ja,
        en: seg.en,
        ja: seg.ja,
        kana: seg.kana,
        keys: input.length,
        t: endTime,
        partial: true,
      })
    }
    flushTracker(trackerRef.current)
    const p = sessionRef.current.progress()
    finish(p.keys, p.mistakes, endTime, startedAt)
  }
  const { now, elapsedSec, liveSpeed: speedFor } = useCountdownTimer({
    active: !finished,
    startTime,
    onTimeout,
    limitMs,
  })
  const liveSpeed = speedFor(typedKeys)
  // 進捗バーは経過時間（0→制限時間）で表す。
  const progress = Math.min(1, startTime !== null && now ? (now - startTime) / limitMs : 0)

  return {
    segments,
    segIndex,
    segInput: input,
    completed,
    hasError,
    typedKeys,
    mistakes,
    missedItems,
    liveSpeed,
    elapsedSec,
    progress,
    finished,
    result,
    records,
    restart,
  }
}
