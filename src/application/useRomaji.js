// ローマ字入力練習の状態機械（最初の打鍵から60秒で終了。ドリルが尽きたら継ぎ足す）。
// 入力モデルは1かなずつ：現在かなに対し英字を1文字ずつ受理判定し、綴り切ったら次のかなへ。
// useTouch と同じイディオム（keydown 配線＋useCountdownTimer 60秒＋ドリル継ぎ足し＋finished）。
//
// 進捗と終了ライフサイクルは TypingSession Entity（domain/session）で駆動する（#290 Phase2b）。
// index(=keys)/mistakes/finished は Entity 由来。可変 Entity は render 中に読めない
// （react-hooks/refs）ので ref 保持し、変更のたび syncSession() が像を state(snap) へ写す
// ＝React はその state で再描画する。終了条件は EndCondition VO（makeEndCondition('time',60)）
// を内包。finish のトリガはタイマー（useCountdownTimer）据え置きで挙動不変。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { kanaOf } from '@tll/core'
import { buildKanaDrill } from '../domain/romaji/drill.service.js'
import { acceptsRomaji, isKanaComplete } from '../domain/romaji/input.service.js'
import { makeEndCondition } from '../domain/session/endCondition.vo.js'
import { createTypingSessionFactory } from '../domain/session/typingSession.factory.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { ROMAJI_LEVELS } from '../content/romaji.js'
import { playMiss } from '../infrastructure/sound.adapter.js'

// application 層のモジュールカウンタで session ID を採番する（純ドメインは ID を作れない）。
let romajiSessionSeq = 0
const nextRomajiId = () => `romaji-${++romajiSessionSeq}`

export function useRomaji({ level, onExit }) {
  // レベル（行グループ）→ 出題かな集合。未知レベルは先頭へフォールバック。
  const kanaSet = useMemo(() => {
    const lv = ROMAJI_LEVELS.find((l) => l.key === level) ?? ROMAJI_LEVELS[0]
    return kanaOf(lv.rowIds)
  }, [level])

  const [targets, setTargets] = useState(() => buildKanaDrill(kanaSet))
  const [input, setInput] = useState('') // 現在かなのローマ字入力バッファ
  const [hasError, setHasError] = useState(false)
  const [wrongKey, setWrongKey] = useState(null) // 直近にミスタイプしたキー
  const [startTime, setStartTime] = useState(null)

  // 終了条件 VO（60秒）と Factory は初回のみ生成する。
  const endCondition = useMemo(() => makeEndCondition('time', 60), [])
  const factory = useMemo(() => createTypingSessionFactory(nextRomajiId), [])

  // 「プレイ1回」を表す可変 Entity（ref 保持）。可変 Entity は render 中に読めない
  // （react-hooks/refs）ので、現在像を state(snap) に写す：mutation のたび syncSession()
  // で session を読み直して {keys,mistakes,finished} スナップショットへ同期する。
  const sessionRef = useRef(null)
  if (sessionRef.current === null) sessionRef.current = factory.start(endCondition)
  const [snap, setSnap] = useState({ keys: 0, mistakes: 0, finished: false })
  // ref 読みはイベント側に閉じる（render 中は ref を読まない＝react-hooks/refs 回避）。
  const syncSession = useCallback(() => {
    const p = sessionRef.current.progress()
    setSnap({ keys: p.keys, mistakes: p.mistakes, finished: sessionRef.current.status() === 'finished' })
  }, [])

  // 派生値（session 像から）。index は確定かな数＝session の keys。
  const { keys, mistakes, finished } = snap
  const index = keys // 確定したかな数（＝タイピング数）
  const current = targets[index] // 今打っているかな

  const restart = useCallback(() => {
    sessionRef.current = factory.start(endCondition) // 新 session（keys/mistakes/status を初期化）
    setTargets(buildKanaDrill(kanaSet))
    setInput('')
    setHasError(false)
    setWrongKey(null)
    setStartTime(null)
    syncSession()
  }, [kanaSet, factory, endCondition, syncSession])

  const { elapsedSec, liveSpeed: speedFor } = useCountdownTimer({
    active: !finished,
    startTime,
    onTimeout: () => {
      sessionRef.current.finish()
      syncSession()
    },
  })

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
      const ch = e.key.toLowerCase()
      const next = input + ch
      if (acceptsRomaji(current, next)) {
        // 受理（途中一致 or 完全一致）。最初の受理で計時開始。
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        setWrongKey(null)
        if (isKanaComplete(current, next)) {
          // このかなを打ち切った → バッファを空にして次のかなへ。
          setInput('')
          // ドリルが尽きたら継ぎ足してループ（60秒の間ずっと打ち続ける）。
          if (index >= targets.length - 1) setTargets((prev) => [...prev, ...buildKanaDrill(kanaSet)])
          sessionRef.current.registerHit() // keys++（＝index を進める）
          syncSession()
        } else {
          setInput(next)
        }
      } else {
        // 受理外＝ミス。バッファは伸ばさない（useTouch と同挙動）。
        sessionRef.current.registerMiss() // mistakes++
        syncSession()
        playMiss()
        setHasError(true)
        setWrongKey(ch)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, current, input, index, targets.length, kanaSet, onExit, restart, syncSession])

  return {
    current,
    input,
    index,
    keys: index, // タイピング数（確定したかな数）
    total: targets.length,
    targets,
    mistakes,
    hasError,
    wrongKey,
    elapsedSec,
    liveSpeed: speedFor(index),
    finished,
    restart,
  }
}
