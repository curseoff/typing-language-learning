// マラソンのゲームセッション（状態機械）。
// active=このモードが表示中か / onFinish(record, segStats)=終了条件到達で呼ぶ。
//
// 打鍵数(keys)とミス数(mistakes)は TypingSession Entity（domain/session）で保持する
// （#290 部分採用）。可変 Entity は render 中に読めない（react-hooks/refs）ので ref に持ち、
// 変更のたび syncSession() が像を state(snap) へ写す＝React はその state で再描画する。
// items/life・終了判定（finish/finishByProgress/onTimeout/escFinish・タイマー）・segStats は
// 従来どおり（Entity の endCondition は器のダミーで、finish 判定には一切使わない）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildPassage } from '../domain/marathon/passage.service.js'
import { score } from '../domain/marathon/scoring.service.js'
import { mulberry32 } from '../domain/rng.service.js'
import { normalizeEndCondition, endLimitMs, shouldFinish, makeEndCondition } from '../domain/session/endCondition.vo.js'
import { createTypingSessionFactory } from '../domain/session/typingSession.factory.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.policy.js'
import { itemId } from '../domain/records/recordKeys.service.js'
import { playMiss } from '../infrastructure/sound.adapter.js'
import { makeSeed } from './seed.policy.js'
import { END_TIME_VALUES } from '../content/endConditions.js'

// エンドレスを ESC で記録するのに必要な最低プレイ時間（30秒＝時間制の最短値）。#208 段6
const ENDLESS_MIN_RECORD_MS = END_TIME_VALUES[0] * 1000

// application 層のモジュールカウンタで session ID を採番する（純ドメインは ID を作れない）。
let marathonSessionSeq = 0
const nextMarathonId = () => `marathon-${++marathonSessionSeq}`

// endCondition 未指定は既定 time60（＝従来の60秒制・従来キー）。
export function useMarathon({ active, onFinish, endCondition }) {
  // 参照を安定させ、finish/タイマーの無用な再生成を避ける（endCondition は親が安定参照で渡す）。
  const ec = useMemo(() => normalizeEndCondition(endCondition), [endCondition])
  const limitMs = endLimitMs(ec)
  const [segments, setSegments] = useState([])
  const [segIndex, setSegIndex] = useState(0)
  const [segInput, setSegInput] = useState('') // 現在セグメントに打ったローマ字/英字
  const [completed, setCompleted] = useState([]) // 確定したセグメントの入力文字列
  const [missedItems, setMissedItems] = useState(0) // ミスした問題数（life 制HUD用の live 値）
  const [hasError, setHasError] = useState(false)
  const [startTime, setStartTime] = useState(null)

  const segStartRef = useRef(null) // 現在の問題の開始時刻
  const segMistakesRef = useRef(0) // 現在の問題のミス数
  const segStatsRef = useRef([]) // 確定した問題ごとの記録
  const ctxRef = useRef({ mode: 'both', rank: 1 }) // 開始時の mode/rank/source/seed
  const poolRef = useRef([]) // 出題プール（継ぎ足し用に保持）
  const trackerRef = useRef(newTracker()) // 問題ごとの累積記録（文単位）
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード
  const startTimeRef = useRef(null) // 時間切れ finish 用に開始時刻を effect から参照する

  // 打鍵数(keys)とミス数(mistakes)を保持する可変 Entity（部分採用）。器の endCondition VO は
  // ダミー（finish 判定には使わない＝session.finish()/isFinished() は呼ばない）。Factory と VO は初回のみ生成。
  const sessionEnd = useMemo(() => makeEndCondition('time', 60), [])
  const factory = useMemo(() => createTypingSessionFactory(nextMarathonId), [])
  const sessionRef = useRef(null)
  if (sessionRef.current === null) sessionRef.current = factory.start(sessionEnd)
  const [snap, setSnap] = useState({ keys: 0, mistakes: 0 })
  // ref 読みはイベント/finish 側に閉じる（render 中は ref を読まない＝react-hooks/refs 回避）。
  const syncSession = useCallback(() => {
    const p = sessionRef.current.progress()
    setSnap({ keys: p.keys, mistakes: p.mistakes })
  }, [])
  const typedKeys = snap.keys // 正しく打った総文字数（session 像由来）
  const mistakes = snap.mistakes // ミス総数（session 像由来）

  // #364 range 有り（単語例文 wsent の固定範囲）＝pool は呼び出し側で freq 順にスライス済み。
  // ここでは ordered:true で pool 順を崩さず流し（毎回同じ並び）、record.range に往復させる。
  const start = useCallback((mode, rank, source, pool, seed, theme, range) => {
    ctxRef.current = { mode, rank, source, seed, theme, range }
    poolRef.current = pool // 問題数制などで出題を継ぎ足すため保持
    // range 時は pool 順で固定（ordered）。それ以外は seed があれば決定的再現・無ければ Math.random。
    const opts = range != null ? { ordered: true } : seed != null ? { rng: mulberry32(seed) } : {}
    setSegments(buildPassage(mode, pool, opts))
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    // 新 session（keys/mistakes を 0 にリセット）。像も 0 へ同期する。
    sessionRef.current = factory.start(sessionEnd)
    syncSession()
    setMissedItems(0)
    setHasError(false)
    setStartTime(null)
    segStartRef.current = null
    segMistakesRef.current = 0
    segStatsRef.current = []
    trackerRef.current = newTracker()
    finishedRef.current = false
    startTimeRef.current = null
  }, [factory, sessionEnd, syncSession])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const { mode, rank, source, seed, theme, range } = ctxRef.current
      // 一発正解数（items 制の主指標）＝完了(非partial)かつミス0の問題数。#208 段3a
      const correctCount = segStatsRef.current.filter(
        (s) => !s.partial && (s.mistakes ?? 0) === 0,
      ).length
      const record = {
        mode,
        rank,
        source,
        theme, // テーマ別ランキング用（単語例文）。未指定モードは undefined のまま
        // #364 range モード時のみ range を載せる（未選択は従来 record と byte 同一＝後方互換）。
        ...(range != null ? { range } : {}),
        seed, // 同じ問題列を再現するためのシード（リプレイ用）
        endCondition: ec, // 終了条件（正規化済み・記録キーの分岐用。#208 段1a）
        speed,
        keys,
        mistakes: totalMistakes,
        accuracy,
        correctCount,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      onFinish(record, segStatsRef.current)
    },
    [onFinish, ec],
  )

  // 進捗（打鍵数/問題数/ミス数）が終了条件に達したら finish（chars/items/life＝時間制以外）。
  // 時間制は elapsedMs が制限に届くまで false のまま＝従来どおりタイマーが終了を担う。
  // 現在入力中の問題があれば partial として segStats に積んでから finish（時間切れと同じ扱い）。
  const finishByProgress = useCallback(
    (t, keys, items, missCount, seg, partialLen) => {
      if (finishedRef.current) return
      const startedAt = startTimeRef.current ?? t
      // life は「ミスした問題数」で判定（打鍵ミス総数 missCount ではない・#208 段5）。
      // 確定問題(segStats)のミス>0件数＋進行中問題が既にミス済みなら+1（問題単位）。
      const missedItems =
        segStatsRef.current.filter((s) => (s.mistakes ?? 0) > 0).length +
        (segMistakesRef.current > 0 ? 1 : 0)
      if (!shouldFinish(ec, { elapsedMs: t - startedAt, keys, items, missedItems })) return
      if (seg && partialLen > 0 && segStartRef.current !== null) {
        const ms = t - segStartRef.current
        segStatsRef.current = [
          ...segStatsRef.current,
          {
            no: segStatsRef.current.length + 1,
            type: seg.type,
            label: seg.type === 'en' ? seg.en : seg.ja,
            en: seg.en,
            ja: seg.ja,
            kana: seg.kana,
            keys: partialLen,
            mistakes: segMistakesRef.current,
            seconds: Math.round(ms / 100) / 10,
            speed: ms > 0 ? Math.round(partialLen / (ms / 60000)) : 0,
            partial: true,
          },
        ]
      }
      flushTracker(trackerRef.current)
      finish(keys, missCount, t, startedAt)
    },
    [ec, finish],
  )

  const handleKey = useCallback(
    (e) => {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      if (finishedRef.current) return
      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        const t = performance.now()
        setStartTime((p) => p ?? t)
        startTimeRef.current = startTimeRef.current ?? t // 時間切れ finish 用
        if (segStartRef.current === null) segStartRef.current = t // 問題の最初の打鍵
        setHasError(false)
        trackKey(trackerRef.current, itemId('s', ctxRef.current.mode, seg.en)) // 文ごと×モード別
        sessionRef.current.registerHit() // keys++（Entity 保持）
        syncSession()
        const ph = sessionRef.current.progress()

        const completesSeg = seg.variants.includes(candidate)

        // 問題が完了したら記録（時間切れ時の未完セグは finish 側で partial 記録）
        if (completesSeg) {
          const segKeys = candidate.length
          const ms = t - segStartRef.current
          segStatsRef.current = [
            ...segStatsRef.current,
            {
              no: segStatsRef.current.length + 1,
              type: seg.type,
              label: seg.type === 'en' ? seg.en : seg.ja,
              en: seg.en,
              ja: seg.ja,
              kana: seg.kana,
              keys: segKeys,
              mistakes: segMistakesRef.current,
              seconds: Math.round(ms / 100) / 10,
              speed: ms > 0 ? Math.round(segKeys / (ms / 60000)) : 0,
              partial: false,
            },
          ]
          segStartRef.current = null
          segMistakesRef.current = 0
          // 出題を打ち尽くしたら継ぎ足す（問題数制などで初期セグメントを超えても続けられる）。
          if (segIndex + 1 >= segments.length) {
            setSegments((prev) => [
              ...prev,
              // range 時は継ぎ足しも pool 順（ordered）＝範囲内を毎回同じ並びでループ。
              ...buildPassage(ctxRef.current.mode, poolRef.current, {
                rng: mulberry32(makeSeed()),
                ordered: ctxRef.current.range != null,
              }),
            ])
          }
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setSegInput('')
          // 完了語は partial 不要（partialLen 0）。
          finishByProgress(t, ph.keys, completed.length + 1, ph.mistakes, seg, 0)
        } else {
          setSegInput(candidate)
          finishByProgress(t, ph.keys, completed.length, ph.mistakes, seg, candidate.length)
        }
      } else {
        sessionRef.current.registerMiss() // mistakes++（Entity 保持）
        syncSession()
        segMistakesRef.current += 1
        trackMiss(trackerRef.current)
        playMiss()
        setHasError(true)
        // ミスした問題数（life 制HUD用）を live 更新＝確定問題のミス>0件数＋進行中問題が既ミスなら+1。
        setMissedItems(
          segStatsRef.current.filter((s) => (s.mistakes ?? 0) > 0).length +
            (segMistakesRef.current > 0 ? 1 : 0),
        )
        // ミス数（life 制）の到達を判定。
        const pm = sessionRef.current.progress()
        finishByProgress(performance.now(), pm.keys, completed.length, pm.mistakes, seg, segInput.length)
      }
    },
    [segments, segIndex, segInput, completed, finishByProgress, syncSession],
  )

  useEffect(() => {
    if (!active) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, handleKey])

  // 最初の正しい打鍵から60秒で終了（キー入力が無くても時間で finish）。
  // 未完セグは partial として segStats に積んでから onFinish を呼ぶ。
  const onTimeout = (endTime, startedAt) => {
    const t = endTime
    const seg = segments[segIndex]
    if (seg && segInput.length > 0 && segStartRef.current !== null) {
      const ms = t - segStartRef.current
      segStatsRef.current = [
        ...segStatsRef.current,
        {
          no: segStatsRef.current.length + 1,
          type: seg.type,
          label: seg.type === 'en' ? seg.en : seg.ja,
          en: seg.en,
          ja: seg.ja,
          kana: seg.kana,
          keys: segInput.length,
          mistakes: segMistakesRef.current,
          seconds: Math.round(ms / 100) / 10,
          speed: ms > 0 ? Math.round(segInput.length / (ms / 60000)) : 0,
          partial: true,
        },
      ]
    }
    flushTracker(trackerRef.current)
    const p = sessionRef.current.progress()
    finish(p.keys, p.mistakes, t, startedAt)
  }
  // エンドレスの ESC 終了（App の ESC ハンドラから呼ぶ）。30秒以上プレイしていれば
  // 未完セグを partial に積んで finish（記録して結果へ）＝true、未満なら false（中断は呼び出し側）。#208 段6
  const escFinish = useCallback(() => {
    if (finishedRef.current) return false
    const t = performance.now()
    const startedAt = startTimeRef.current ?? t
    if (t - startedAt < ENDLESS_MIN_RECORD_MS) return false
    const seg = segments[segIndex]
    if (seg && segInput.length > 0 && segStartRef.current !== null) {
      const ms = t - segStartRef.current
      segStatsRef.current = [
        ...segStatsRef.current,
        {
          no: segStatsRef.current.length + 1,
          type: seg.type,
          label: seg.type === 'en' ? seg.en : seg.ja,
          en: seg.en,
          ja: seg.ja,
          kana: seg.kana,
          keys: segInput.length,
          mistakes: segMistakesRef.current,
          seconds: Math.round(ms / 100) / 10,
          speed: ms > 0 ? Math.round(segInput.length / (ms / 60000)) : 0,
          partial: true,
        },
      ]
    }
    flushTracker(trackerRef.current)
    const p = sessionRef.current.progress()
    finish(p.keys, p.mistakes, t, startedAt)
    return true
  }, [segments, segIndex, segInput, finish])

  const { elapsedSec, liveSpeed: speedFor } = useCountdownTimer({ active, startTime, onTimeout, limitMs })

  return {
    start,
    escFinish,
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    typedKeys,
    mistakes,
    missedItems,
    liveSpeed: speedFor(typedKeys),
    elapsedSec,
  }
}
