// タッチタイピング練習の状態機械（最初の打鍵から60秒で終了。ドリルが尽きたら継ぎ足す）。
//
// 進捗と終了ライフサイクルは TypingSession Entity（domain/session）で駆動する（#290 Phase2b）。
// index(=typedKeys=keys)/mistakes/finished は Entity 由来。可変 Entity は render 中に読めない
// （react-hooks/refs）ので ref 保持し、変更のたび syncSession() が像を state(snap) へ写す
// ＝React はその state で再描画する。終了条件は EndCondition VO（makeEndCondition('time',60)）
// を内包。finish のトリガはタイマー（useCountdownTimer）据え置きで挙動不変。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildDrill } from '../domain/touch/drill.service.js'
import { makeEndCondition } from '../domain/session/endCondition.vo.js'
import { createTypingSessionFactory } from '../domain/session/typingSession.factory.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { TOUCH_LEVELS } from '../content/keyboard.js'
import { playMiss } from '../infrastructure/sound.js'

// application 層のモジュールカウンタで session ID を採番する（純ドメインは ID を作れない）。
let touchSessionSeq = 0
const nextTouchId = () => `touch-${++touchSessionSeq}`

export function useTouch({ level, onExit }) {
  const keys = (TOUCH_LEVELS.find((l) => l.key === level) ?? TOUCH_LEVELS[0]).keys
  const [targets, setTargets] = useState(() => buildDrill(keys))
  const [hasError, setHasError] = useState(false)
  const [wrongKey, setWrongKey] = useState(null) // 直近にミスタイプしたキー（押したキー）
  const [pressed, setPressed] = useState({ key: null, tick: 0 }) // 直近に押したキー（沈み込みアニメ用。tickで連打も再発火）
  const [startTime, setStartTime] = useState(null)

  // 終了条件 VO（60秒）と Factory は初回のみ生成する。
  const endCondition = useMemo(() => makeEndCondition('time', 60), [])
  const factory = useMemo(() => createTypingSessionFactory(nextTouchId), [])

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

  // 派生値（session 像から）。index は正しく打ったキー数＝session の keys。
  const { keys: index, mistakes, finished } = snap
  const target = targets[index]

  const restart = useCallback(() => {
    sessionRef.current = factory.start(endCondition) // 新 session（keys/mistakes/status を初期化）
    setTargets(buildDrill(keys))
    setHasError(false)
    setWrongKey(null)
    setPressed({ key: null, tick: 0 })
    setStartTime(null)
    syncSession()
  }, [keys, factory, endCondition, syncSession])

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
      const k = e.key.toLowerCase()
      const ok = k === target
      setPressed((p) => ({ key: k, tick: p.tick + 1, ok })) // 押したキーを沈み込ませる（ok=正解なら緑枠）
      if (ok) {
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        setWrongKey(null)
        // ドリルが尽きたら継ぎ足してループ（60秒の間ずっと打ち続ける）。
        if (index >= targets.length - 1) setTargets((prev) => [...prev, ...buildDrill(keys)])
        sessionRef.current.registerHit() // keys++（＝index を進める）
        syncSession()
      } else {
        sessionRef.current.registerMiss() // mistakes++
        syncSession()
        playMiss()
        setHasError(true)
        setWrongKey(e.key.toLowerCase()) // 押した（誤った）キーを記録して枠を光らせる
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, target, index, targets.length, keys, onExit, restart, syncSession])

  return {
    target,
    index,
    typedKeys: index, // タイピング数（正しく打ったキー数）
    total: targets.length,
    mistakes,
    hasError,
    wrongKey,
    pressed,
    elapsedSec,
    liveSpeed: speedFor(index),
    finished,
    restart,
    targets,
  }
}
