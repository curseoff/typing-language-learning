// 英英辞典の入力モード（英語入力=定義文を打つ / 日本語入力=和訳を打つ / both=英→日）。
// 単語例文（マラソン）と同じ「最初の打鍵から60秒で終了」方式。問題が尽きたら継ぎ足してループする。
// 記録は dict 記録（DictResult）を維持する。
//
// 打鍵数(keys)とミス数(mistakes)は TypingSession Entity（domain/session）で保持する
// （#290 部分採用）。可変 Entity は render 中に読めない（react-hooks/refs）ので ref に持ち、
// 変更のたび syncSession() が像を state(snap) へ写す＝React はその state で再描画する。
// items/life・終了判定（finish/finishByProgress/finishByEsc/onTimeout・タイマー）・segTracker は
// 従来どおり（Entity の endCondition は器のダミーで、finish 判定には一切使わない）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildPassage } from '../domain/marathon/passage.service.js'
import { wordsInRangeBy, RANGE_SIZE } from '../domain/words/wordRange.service.js'
import { makeScoreRecord } from '../domain/records/scoreRecord.vo.js'
import { mulberry32 } from '../domain/rng.service.js'
import { normalizeEndCondition, endLimitMs, shouldFinish, makeEndCondition } from '../domain/session/endCondition.vo.js'
import { itemsTargetFor } from '../domain/session/learningSequence.service.js'
import { isClozeRevealed } from '../domain/typing/cloze.service.js'
import { createTypingSessionFactory } from '../domain/session/typingSession.factory.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { loadDictRecords, saveDictRecord, recordItemStat } from './records.service.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.policy.js'
import { newSegTracker, segMark, segMiss, segPush, segMissedItems } from './segTracker.policy.js'
import { itemId } from '../domain/records/recordKeys.service.js'
import { firstTryCorrectCount } from '../domain/records/segmentStats.service.js'
import { playMiss } from '../infrastructure/sound.adapter.js'
import { makeSeed } from './seed.policy.js'
import { END_TIME_VALUES } from '../content/endConditions.js'

// エンドレスを ESC で記録するのに必要な最低プレイ時間（30秒＝時間制の最短値）。#208 段6
const ENDLESS_MIN_RECORD_MS = END_TIME_VALUES[0] * 1000

// application 層のモジュールカウンタで session ID を採番する（純ドメインは ID を作れない）。
let dictSessionSeq = 0
const nextDictId = () => `dict-${++dictSessionSeq}`

// 文字列を 32bit 整数へ決定的に写す（FNV-1a）。cloze の mask 選定 seed に使う（#402）。
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// 定義文（item.en＝def）ごとに決定的な mask 用 rng を返す。seed と文キーを混ぜて再現可能にする。
const maskRngFactory = (seed) => (item) => mulberry32((fnv1a(item.en) ^ (seed >>> 0)) >>> 0)

// dict エントリを buildPassage の pool 形式 {word, en, ja, kana} に整える。
const toDictSeg = (e) => ({ word: e.word, en: e.def, ja: e.ja, kana: e.kana })

// dict を level/theme で絞り、buildPassage の pool 形式 {word, en, ja, kana} に整える。
function dictPool(dict, level, theme) {
  let p = dict.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  if (p.length === 0) p = dict.filter((d) => d.level === level)
  if (p.length === 0) p = dict
  return p.map(toDictSeg)
}

// #364 range 時：strict な level×theme（フォールバック無し）を freq 順で 100 件区切りにスライスした
// 範囲プール（決定的）。dict は freq を持たないため freqMap から freqOf/keyOf を組む。空スライス（無効
// range）は null＝呼び出し側で従来プールへフォールバック。
function dictRangePool(dict, level, theme, range, freqMap) {
  const freqOf = (e) => freqMap?.get(e.word) ?? null
  const strict = dict.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  const sliced = wordsInRangeBy(strict, range, RANGE_SIZE, freqOf, (e) => e.word)
  return sliced.length > 0 ? sliced.map(toDictSeg) : null
}

// endCondition 未指定は既定 time60（＝従来の60秒制・従来キー）。
// #364 range 有り（英英固定範囲）＝範囲内を freq 順で決定的に流し record.range に往復させる。
// #402 learningMode='cloze'（英英の穴埋め）＝5問ブロックで通常→穴埋めを交互に出し、穴埋めフェーズは
//   定義文の内容語 1〜3 語を伏字にする。normal は従来と完全に同一。英語を打つモード（en/both）のみ。
export function useDict({ dict, level, theme, mode, seed, endCondition, range, freqMap, learningMode = 'normal', onExit }) {
  const isCloze = learningMode === 'cloze'
  // 参照を安定させ、finish/タイマーの無用な再生成を避ける（endCondition は親が安定参照で渡す）。
  const ec = useMemo(() => normalizeEndCondition(endCondition), [endCondition])
  // 終了判定用の実効 endCondition。cloze かつ問題数制のみ目標を2倍（normal→穴埋めの2周ぶん）。
  const finishEc = useMemo(
    () => (isCloze && ec.kind === 'items' ? makeEndCondition('items', itemsTargetFor(ec, 'cloze')) : ec),
    [ec, isCloze],
  )
  const limitMs = endLimitMs(ec)
  // 「今プレイ中の問題列」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに切り直し、record には必ずこの seed を保存して再現可能にする。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  // range 時は範囲プール（freq 順・決定的）を優先。無効 range（空）は従来プールへフォールバック。
  const rangePool = useMemo(
    () => (range != null ? dictRangePool(dict, level, theme, range, freqMap) : null),
    [dict, level, theme, range, freqMap],
  )
  const pool = useMemo(() => rangePool ?? dictPool(dict, level, theme), [rangePool, dict, level, theme])
  const ordered = rangePool != null // 範囲プール適用時のみ pool 順で固定（毎回同じ並び）
  const buildSegments = useCallback(
    (s) =>
      buildPassage(mode, pool, {
        rng: mulberry32(s),
        ordered,
        // cloze 時は 5問ブロック交互＋文中伏字（mask はビルド seed＋文キーで決定的）。normal は素通り。
        ...(isCloze ? { cloze: { maskRng: maskRngFactory(s) } } : {}),
      }),
    [mode, pool, ordered, isCloze],
  )
  const [segments, setSegments] = useState(() => buildSegments(sessionSeed))
  const [segIndex, setSegIndex] = useState(0)
  const [segInput, setSegInput] = useState('') // 現在セグメントに打った文字
  const [completed, setCompleted] = useState([]) // 確定したセグメントの入力文字列
  const [missedItems, setMissedItems] = useState(0) // ミスした問題数（life 制HUD用の live 値）
  const [hasError, setHasError] = useState(false)
  const [segMistaken, setSegMistaken] = useState(false) // 現在問題でミスがあったか（cloze の正解開示用）
  const [startTime, setStartTime] = useState(null)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadDictRecords())
  const trackerRef = useRef(newTracker()) // 見出し語ごとの累積記録
  const segTrackerRef = useRef(newSegTracker()) // 今回プレイの問題ごとの記録
  const finishedRef = useRef(false) // finish を一度だけ呼ぶためのガード
  const startTimeRef = useRef(null) // 進捗 finish 用の開始時刻（startTime と同値）

  // 打鍵数(keys)とミス数(mistakes)を保持する可変 Entity（部分採用）。器の endCondition VO は
  // ダミー（finish 判定には使わない＝session.finish()/isFinished() は呼ばない）。Factory と VO は初回のみ生成。
  const sessionEnd = useMemo(() => makeEndCondition('time', 60), [])
  const factory = useMemo(() => createTypingSessionFactory(nextDictId), [])
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

  const restart = useCallback(() => {
    {
      const { next, emit } = flushTracker(trackerRef.current)
      trackerRef.current = next
      if (emit) recordItemStat(emit.id, emit.delta)
    }
    segTrackerRef.current = newSegTracker()
    // 「もう一度」は毎回新しい問題列にする＝新しい seed を切り直して record にも反映。
    const next = makeSeed()
    setSessionSeed(next)
    setSegments(buildSegments(next))
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    // 新 session（keys/mistakes を 0 にリセット）。像も 0 へ同期する。
    sessionRef.current = factory.start(sessionEnd)
    syncSession()
    setMissedItems(0)
    setHasError(false)
    setSegMistaken(false)
    setStartTime(null)
    setFinished(false)
    setResult(null)
    finishedRef.current = false
    startTimeRef.current = null
  }, [buildSegments, factory, sessionEnd, syncSession])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      const list = segTrackerRef.current.list
      // 打ち終えた「文の数」。both は1文=en+ja の2セグなので、sentenceIndex のユニーク数で数える。
      const words = new Set(list.map((s) => s.sentenceIndex)).size
      // 一発正解数（items 制の主指標）＝完了(非partial)かつミス0の問題数。#208 段3a
      const correctCount = firstTryCorrectCount(list)
      // 記録生成は domain の makeScoreRecord に集約（採点＝makeScore を内包）。#389
      // session Entity は elapsedMs を保持しないため明示値を渡し、凍結は plain 展開して形状を保つ。
      const record = {
        ...makeScoreRecord({
          keys,
          mistakes: totalMistakes,
          elapsedMs,
          meta: {
            source: 'dict', // リプレイの分岐用（App.replay）
            seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
            endCondition: ec, // 終了条件（正規化済み・記録キーの分岐用。#208 段1a）
            level,
            theme,
            mode,
            words,
            correctCount,
            // range モード時のみ range を載せる（未選択は従来キー＝後方互換のため付けない）。
            ...(range != null ? { range } : {}),
            // #402 cloze 時のみ learning を載せる（normal は従来 record と byte 同一＝後方互換）。
            ...(isCloze ? { learning: learningMode } : {}),
            segStats: list,
            date: new Date().toLocaleString('ja-JP'),
          },
        }),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, range, sessionSeed, ec, isCloze, learningMode],
  )

  // 進捗（打鍵数/問題数/ミス数）が終了条件に達したら finish（chars/items/life＝時間制以外）。
  // 時間制は elapsedMs が制限に届くまで false のまま＝従来どおりタイマーが終了を担う。
  // 現在入力中の問題があれば partial として記録に積んでから finish（時間切れと同じ扱い）。
  const finishByProgress = useCallback(
    (t, keys, items, missCount, seg, partialLen) => {
      if (finishedRef.current) return
      const startedAt = startTimeRef.current ?? t
      // life は「ミスした問題数」で判定（打鍵ミス総数 missCount ではない・#208 段5）。
      const missedItems = segMissedItems(segTrackerRef.current)
      if (!shouldFinish(finishEc, { elapsedMs: t - startedAt, keys, items, missedItems })) return
      if (seg && partialLen > 0) {
        segPush(segTrackerRef.current, {
          type: seg.type,
          label: seg.word,
          keys: partialLen,
          t,
          partial: true,
          sentenceIndex: seg.sentenceIndex,
        })
      }
      {
        const { next, emit } = flushTracker(trackerRef.current)
        trackerRef.current = next
        if (emit) recordItemStat(emit.id, emit.delta)
      }
      finish(keys, missCount, t, startedAt)
    },
    [finishEc, finish],
  )

  // エンドレスは ESC が唯一の終了手段。30秒以上プレイしていれば記録して結果へ、
  // それ未満（未打鍵で startTime 未確定なら経過0扱い）は中断＝onExit（#208 段6）。
  const finishByEsc = useCallback(() => {
    if (finishedRef.current) return false
    const t = performance.now()
    const startedAt = startTimeRef.current ?? t
    if (t - startedAt < ENDLESS_MIN_RECORD_MS) return false
    const seg = segments[segIndex]
    if (seg && segInput.length > 0) {
      segPush(segTrackerRef.current, {
        type: seg.type,
        label: seg.word,
        keys: segInput.length,
        t,
        partial: true,
        sentenceIndex: seg.sentenceIndex,
      })
    }
    {
      const { next, emit } = flushTracker(trackerRef.current)
      trackerRef.current = next
      if (emit) recordItemStat(emit.id, emit.delta)
    }
    const p = sessionRef.current.progress()
    finish(p.keys, p.mistakes, t, startedAt)
    return true
  }, [segments, segIndex, segInput, finish])

  const handleKey = useCallback(
    (e) => {
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
      if (finishedRef.current) return

      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        const t = performance.now()
        setStartTime((p) => p ?? t)
        startTimeRef.current = startTimeRef.current ?? t // 進捗 finish 用
        setHasError(false)
        segMark(segTrackerRef.current, t) // この問題の最初の打鍵時刻
        {
          const { next, emit } = trackKey(trackerRef.current, itemId('d', mode, seg.word), performance.now()) // 見出し語ごと×モード別
          trackerRef.current = next
          if (emit) recordItemStat(emit.id, emit.delta)
        }
        sessionRef.current.registerHit() // keys++（Entity 保持）
        syncSession()
        const ph = sessionRef.current.progress()

        const completesSeg = seg.variants.includes(candidate)

        // 問題が完了したら「問題ごとの記録」に積む（未完は finish 側で partial 記録）
        if (completesSeg) {
          segPush(segTrackerRef.current, {
            type: seg.type,
            label: seg.word,
            keys: candidate.length,
            t,
            partial: false,
            sentenceIndex: seg.sentenceIndex,
          })
          // 問題を打ち尽くしたら継ぎ足してループ（sentenceIndex は衝突しないようオフセット）。
          if (segIndex + 1 >= segments.length) {
            setSegments((prev) => {
              const offset = prev.length ? prev[prev.length - 1].sentenceIndex + 1 : 0
              const more = buildSegments(makeSeed()).map((s) => ({
                ...s,
                sentenceIndex: s.sentenceIndex + offset,
              }))
              return [...prev, ...more]
            })
          }
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setSegInput('')
          setSegMistaken(false) // 次の問題へ＝開示状態をリセット
          finishByProgress(t, ph.keys, completed.length + 1, ph.mistakes, seg, 0)
        } else {
          setSegInput(candidate)
          finishByProgress(t, ph.keys, completed.length, ph.mistakes, seg, candidate.length)
        }
      } else {
        sessionRef.current.registerMiss() // mistakes++（Entity 保持）
        syncSession()
        trackerRef.current = trackMiss(trackerRef.current).next
        segMiss(segTrackerRef.current)
        setMissedItems(segMissedItems(segTrackerRef.current)) // ミスした問題数を live 更新（life 制HUD用）
        playMiss()
        setHasError(true)
        setSegMistaken(true) // cloze: この問題は以後 正解を開示する
        // ミス数（life 制）の到達を判定。
        const pm = sessionRef.current.progress()
        finishByProgress(performance.now(), pm.keys, completed.length, pm.mistakes, seg, segInput.length)
      }
    },
    [finished, segments, segIndex, segInput, completed, mode, buildSegments, onExit, restart, finishByProgress, ec, finishByEsc, syncSession],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // 最初の打鍵から60秒で終了（キー入力が無くても時間で finish）。
  // 現在入力中の問題があれば partial として記録に積んでから finish。
  const onTimeout = (endTime, startedAt) => {
    const t = endTime
    const seg = segments[segIndex]
    if (seg && segInput.length > 0) {
      segPush(segTrackerRef.current, {
        type: seg.type,
        label: seg.word,
        keys: segInput.length,
        t,
        partial: true,
        sentenceIndex: seg.sentenceIndex,
      })
    }
    {
      const { next, emit } = flushTracker(trackerRef.current)
      trackerRef.current = next
      if (emit) recordItemStat(emit.id, emit.delta)
    }
    const p = sessionRef.current.progress()
    finish(p.keys, p.mistakes, t, startedAt)
  }
  const { elapsedSec, liveSpeed: speedFor } = useCountdownTimer({
    active: !finished,
    startTime,
    onTimeout,
    limitMs,
  })

  return {
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    clozeRevealed: isClozeRevealed(learningMode, segMistaken ? 1 : 0), // cloze でこの問題にミスがあり開示中か
    typedKeys,
    mistakes,
    missedItems,
    liveSpeed: speedFor(snap.keys),
    elapsedSec,
    word: segments[segIndex]?.word, // 現在セグの見出し語
    finished,
    result,
    records,
    restart,
  }
}
