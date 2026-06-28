// タッチタイピング練習の状態機械（最初の打鍵から60秒で終了。ドリルが尽きたら継ぎ足す）。
import { useCallback, useEffect, useState } from 'react'
import { buildDrill } from '../domain/touch/drill.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { TOUCH_LEVELS } from '../content/keyboard.js'

export function useTouch({ level, onExit }) {
  const keys = (TOUCH_LEVELS.find((l) => l.key === level) ?? TOUCH_LEVELS[0]).keys
  const [targets, setTargets] = useState(() => buildDrill(keys))
  const [index, setIndex] = useState(0) // 正しく打ったキー数＝タイピング数
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [wrongKey, setWrongKey] = useState(null) // 直近にミスタイプしたキー（押したキー）
  const [pressed, setPressed] = useState({ key: null, tick: 0 }) // 直近に押したキー（沈み込みアニメ用。tickで連打も再発火）
  const [finished, setFinished] = useState(false)
  const [startTime, setStartTime] = useState(null)

  const target = targets[index]

  const restart = useCallback(() => {
    setTargets(buildDrill(keys))
    setIndex(0)
    setMistakes(0)
    setHasError(false)
    setWrongKey(null)
    setPressed({ key: null, tick: 0 })
    setFinished(false)
    setStartTime(null)
  }, [keys])

  const { elapsedSec, liveSpeed: speedFor } = useCountdownTimer({
    active: !finished,
    startTime,
    onTimeout: () => setFinished(true),
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
        setIndex((i) => i + 1)
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
        setWrongKey(e.key.toLowerCase()) // 押した（誤った）キーを記録して枠を光らせる
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, target, index, targets.length, keys, onExit, restart])

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
