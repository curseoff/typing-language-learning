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
import { buildClozeUnits, isClozeRevealed, clozeSideFor } from '../domain/typing/cloze.service.js'
import { tagLearningBlocks, itemsTargetFor } from '../domain/session/learningSequence.service.js'
import { makeScoreRecord } from '../domain/records/scoreRecord.vo.js'
import { mulberry32 } from '../domain/rng.service.js'
import { normalizeEndCondition, endLimitMs, shouldFinish, makeEndCondition } from '../domain/session/endCondition.vo.js'
import { createTypingSessionFactory } from '../domain/session/typingSession.factory.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { loadWordRecords, saveWordRecord, recordItemStat } from './records.service.js'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.policy.js'
import { newSegTracker, segMark, segMiss, segPush, segMissedItems } from './segTracker.policy.js'
import { itemId } from '../domain/records/recordKeys.service.js'
import { firstTryCorrectCount } from '../domain/records/segmentStats.service.js'
import { segMaskLen } from '../domain/versus/progressMask.service.js'
import { mirrorCursor } from '../domain/versus/mirrorCursor.service.js'
import { playMiss } from '../infrastructure/sound.adapter.js'
import { makeSeed } from './seed.policy.js'
import { END_TIME_VALUES } from '../content/endConditions.js'

// エンドレスを ESC で記録するのに必要な最低プレイ時間（30秒＝時間制の最短値）。#208 段6
const ENDLESS_MIN_RECORD_MS = END_TIME_VALUES[0] * 1000

// application 層のモジュールカウンタで session ID を採番する（純ドメインは ID を作れない）。
let wordsSessionSeq = 0
const nextWordsId = () => `words-${++wordsSessionSeq}`

// endCondition 未指定は既定 time60（＝従来の60秒制・従来キー）。
// #362 range 有り（単語固定範囲）＝範囲内を freq 順で決定的に出題し、record.range に往復させる。
// #402 learningMode='cloze'＝5問ブロックで「通常→穴埋め」を交互に出す（問題数制は2倍が実効目標）。
//   normal（既定）は従来と完全に同一挙動（tag も cloze も掛けない）。
// #432 対戦：onProgress（任意）＝打鍵ごとに手元の進捗スナップショットを外へ通知する（useDict と同形）。
//   未指定（既定 undefined）は従来と完全に同一挙動（後方互換）。
// #432 対戦：autoStart（任意・既定 false）＝true なら初回打鍵を待たずマウント時から計時を開始する
//   （lazy 初期化で最初の render 時刻を startTime にする＝レース開始と同時に時間が進む）。未指定（solo）は
//   従来どおり初回打鍵で開始＝挙動を一切変えない。
// #443 対戦：active（任意・既定 true）＝false ならキー入力を無視する（サドンデス脱落後に盤面を止める）。
//   非対戦の通常プレイは未指定＝true のままで挙動不変。useMarathon の active と同じ作法。
export function useWords({ allWords, level, theme, mode, seed, endCondition, range, learningMode = 'normal', onExit, onProgress, autoStart = false, active = true }) {
  const isCloze = learningMode === 'cloze'
  // 出題列（問題）をブロックタグ付け／セグメント化するヘルパ。normal は素通り＝従来と同形。
  //   cloze … tagLearningBlocks で 5問ずつ normal→cloze を交互展開（出力は 2×・{item,phase}）。
  //   normal … 単語 item をそのまま（buildUnits で従来どおりセグメント化）。
  const toProblems = useCallback(
    (items) => (isCloze ? tagLearningBlocks(items, { blockSize: 5 }) : items),
    [isCloze],
  )
  // 参照を安定させ、finish/タイマーの無用な再生成を避ける（endCondition は親が安定参照で渡す）。
  const ec = useMemo(() => normalizeEndCondition(endCondition), [endCondition])
  // 終了判定用の実効 endCondition。cloze かつ問題数制のみ目標を2倍にする（記録キー用の ec は原値のまま）。
  const finishEc = useMemo(
    () => (isCloze && ec.kind === 'items' ? makeEndCondition('items', itemsTargetFor(ec, 'cloze')) : ec),
    [ec, isCloze],
  )
  const limitMs = endLimitMs(ec)
  // 「今プレイ中の問題列」を決める seed。初回はリプレイなら渡された seed、通常プレイなら新規生成。
  // restart のたびに新しい seed を切り直す（＝View 内「もう一度」は別の問題列）。
  // この seed を record に必ず保存することで、通常プレイの記録も再現可能になる。
  const [sessionSeed, setSessionSeed] = useState(() => (seed != null ? seed : makeSeed()))
  // both×cloze で「英語 or 読み」どちらを伏せるかを語ごとに seed 由来で決める（#402）。
  // 語の同一性（words.js で一意な en）を FNV-1a で 32bit 化し sessionSeed と混ぜて mulberry32 に渡す。
  //   ・同じ seed・同じ語なら常に同じ側＝リプレイ/「毎回同じ順で復習」で再現する。
  //   ・normal フェーズ（伏せない）と cloze フェーズで同じ語なら同じ側判定になる（位置に依らない）。
  // both 以外（en/ja 単一）は対象側が自明なので側選択は不要。
  const clozeSideOf = useCallback(
    (item) => (mode !== 'both' ? undefined : clozeSideFor(sessionSeed, item.en)),
    [mode, sessionSeed],
  )
  const unitsOf = useCallback(
    (p) =>
      isCloze
        ? p.phase === 'cloze'
          ? buildClozeUnits(p.item, mode, { clozeSide: clozeSideOf(p.item) })
          : buildUnits(p.item, mode)
        : buildUnits(p, mode),
    [isCloze, mode, clozeSideOf],
  )
  const buildPassage = useCallback(
    () => toProblems(buildWordPassage(allWords, level, theme, mode, { rng: mulberry32(sessionSeed), range })),
    [allWords, level, theme, mode, sessionSeed, range, toProblems],
  )
  const [words, setWords] = useState(buildPassage)
  const [segIndex, setSegIndex] = useState(0)
  const [input, setInput] = useState('')
  const [completed, setCompleted] = useState([])
  const [hasError, setHasError] = useState(false)
  const [segMistaken, setSegMistaken] = useState(false) // 現在語でミスがあったか（cloze の正解開示用）
  const [missedItems, setMissedItems] = useState(0) // ミスした問題数（life 制HUD用の live 値）
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadWordRecords())
  const [startTime, setStartTime] = useState(() => (autoStart ? performance.now() : null))
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
  // cloze フェーズの語は buildClozeUnits で seg に cloze/hint が付く（normal は従来どおり）。
  const segments = useMemo(
    () => words.flatMap((w, wi) => unitsOf(w).map((s) => ({ ...s, sentenceIndex: wi }))),
    [words, unitsOf],
  )
  const seg = segments[segIndex]
  // cloze でこの語にミスがあれば正解を開示する（seg 完了でリセット）。
  const clozeRevealed = isClozeRevealed(learningMode, segMistaken ? 1 : 0)

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
    setWords(toProblems(buildWordPassage(allWords, level, theme, mode, { rng: mulberry32(next), range })))
    setSegIndex(0)
    setInput('')
    setCompleted([])
    setHasError(false)
    setSegMistaken(false)
    // 新 session（keys/mistakes を 0 にリセット）。像も 0 へ同期する。
    sessionRef.current = factory.start(sessionEnd)
    syncSession()
    setMissedItems(0)
    setFinished(false)
    setResult(null)
    setStartTime(null)
    finishedRef.current = false
  }, [allWords, level, theme, mode, range, factory, sessionEnd, syncSession, toProblems])

  const finish = useCallback(
    (keys, totalMistakes, endTime, startedAt) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const elapsedMs = endTime - startedAt
      // 一発正解数（items 制の主指標）＝完了(非partial)かつミス0の問題数。#208 段3a
      const correctCount = firstTryCorrectCount(segTrackerRef.current.list)
      // 記録生成は domain の makeScoreRecord に集約（採点＝makeScore を内包）。#389
      // session Entity は elapsedMs を保持しないため明示値を渡し、凍結は plain 展開して形状を保つ。
      const record = {
        ...makeScoreRecord({
          keys,
          mistakes: totalMistakes,
          elapsedMs,
          meta: {
            source: 'word', // リプレイの分岐用（App.replay）
            seed: sessionSeed, // この記録の問題列を再現するためのシード（通常プレイでも必ず入る）
            endCondition: ec, // 終了条件（正規化済み・記録キーの分岐用。#208 段1a）
            level,
            theme,
            mode,
            correctCount,
            // range モード時のみ range を載せる（未選択は従来キー＝後方互換のため付けない）。
            ...(range != null ? { range } : {}),
            // #402 cloze 時のみ learning を載せる（normal は従来 record と byte 同一＝後方互換）。
            ...(isCloze ? { learning: learningMode } : {}),
            segStats: segTrackerRef.current.list,
            date: new Date().toLocaleString('ja-JP'),
          },
        }),
      }
      setRecords(saveWordRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, mode, range, sessionSeed, ec, isCloze, learningMode],
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
      if (!shouldFinish(finishEc, { elapsedMs: t - startedAt, keys, items, missedItems })) return
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
      {
        const { next, emit } = flushTracker(trackerRef.current)
        trackerRef.current = next
        if (emit) recordItemStat(emit.id, emit.delta)
      }
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
      {
        const { next, emit } = flushTracker(trackerRef.current)
        trackerRef.current = next
        if (emit) recordItemStat(emit.id, emit.delta)
      }
      const p = sessionRef.current.progress()
      finish(p.keys, p.mistakes, t, startedAt)
      return true
    }
    const onKey = (e) => {
      if (!active) return // #443 脱落後（対戦）は打鍵を一切処理しない
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
        {
          const { next, emit } = trackKey(trackerRef.current, itemId('w', mode, seg.en), performance.now()) // 単語ごと×モード別
          trackerRef.current = next
          if (emit) recordItemStat(emit.id, emit.delta)
        }
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
          // cloze は継ぎ足しバッチ単位でタグ付け＝5問リズムをバッチ境界で保つ。
          if (segIndex + 1 >= segments.length) {
            setWords((prev) => [
              ...prev,
              ...toProblems(buildWordPassage(allWords, level, theme, mode, { rng: mulberry32(makeSeed()), range })),
            ])
          }
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setInput('')
          setSegMistaken(false) // 次の語へ＝開示状態をリセット
        } else {
          setInput(candidate)
        }
        // 正打のたびに打鍵数/問題数の到達を判定（完了語は partial 記録不要＝partialLen 0）。
        const ph = sessionRef.current.progress()
        finishByProgress(t, ph.keys, completed.length + (completesSeg ? 1 : 0), ph.mistakes, completesSeg ? 0 : candidate.length)
      } else {
        sessionRef.current.registerMiss() // mistakes++（Entity 保持）
        syncSession()
        trackerRef.current = trackMiss(trackerRef.current).next
        segMiss(segTrackerRef.current)
        setMissedItems(segMissedItems(segTrackerRef.current)) // ミスした問題数を live 更新（life 制HUD用）
        playMiss()
        setHasError(true)
        setSegMistaken(true) // cloze: この語は以後 正解を開示する
        // ミス数（life 制）の到達を判定。
        const pm = sessionRef.current.progress()
        finishByProgress(t, pm.keys, completed.length, pm.mistakes, input.length)
      }
      // #432 対戦：この打鍵後の手元の進捗を外へ通知（ハンドラ内なので ref 読みは安全）。
      // #437 伏せ字マスバー用：今打っている対象（seg）の実長 curPos/curLen とミス中フラグ miss を載せる。
      if (onProgress) {
        const pp = sessionRef.current.progress()
        const wasHit = segMatches(seg, candidate)
        const prefix = wasHit ? candidate : input
        const { curPos, curLen } = segMaskLen({ variants: seg.variants, prefix })
        // #439 道Y：qIndex・打鍵側 typedSide・TopFlow 表示単位進捗 boardCurPos（en=空白込み char／ja=かな消費数
        //   ＝受信側 MirrorPlayView の curPos に一致）を載せる。※board 材料（方式B）は PR-E で撤去予定・受信側未使用。
        const cur = mirrorCursor({ seg, segInput: prefix })
        onProgress({
          typed: pp.keys,
          mistakes: pp.mistakes,
          segStats: segTrackerRef.current.list,
          currentMistakes: segTrackerRef.current.mistakes,
          curPos,
          curLen,
          miss: !wasHit,
          qIndex: seg.sentenceIndex,
          typedSide: cur.typedSide,
          boardCurPos: cur.curPos,
          board: { word: seg.word, en: seg.en, ja: seg.ja, kana: seg.kana },
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finished, seg, segIndex, segments.length, input, completed, startTime, ec, finishEc, mode, allWords, level, theme, range, onExit, restart, finish, syncSession, toProblems, onProgress])

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
    {
      const { next, emit } = flushTracker(trackerRef.current)
      trackerRef.current = next
      if (emit) recordItemStat(emit.id, emit.delta)
    }
    const p = sessionRef.current.progress()
    finish(p.keys, p.mistakes, endTime, startedAt)
  }
  // #443 対戦：active=false（脱落 or 対戦終了）でも計時を止める＝速度・経過が最後の値で確定する
  //   （打鍵が止まっているのに分母だけ伸びて速度が下がり続けるのを防ぐ）。非対戦は active 既定 true で挙動不変。
  const { now, elapsedSec, liveSpeed: speedFor } = useCountdownTimer({
    active: active && !finished,
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
    clozeRevealed, // cloze でこの語にミスがあり正解を開示中か
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
