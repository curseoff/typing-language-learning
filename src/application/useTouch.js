// タッチタイピング練習の状態機械（記録は保存しない）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildDrill } from '../domain/touch/drill.js'
import { TOUCH_LEVELS } from '../content/keyboard.js'

export function useTouch({ level, onExit }) {
  const keys = (TOUCH_LEVELS.find((l) => l.key === level) ?? TOUCH_LEVELS[0]).keys
  const [targets, setTargets] = useState(() => buildDrill(keys))
  const [index, setIndex] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [wrongKey, setWrongKey] = useState(null) // 直近にミスタイプしたキー（押したキー）
  const [pressed, setPressed] = useState({ key: null, tick: 0 }) // 直近に押したキー（沈み込みアニメ用。tickで連打も再発火）
  const [now, setNow] = useState(0)
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
    setNow(0)
    setFinished(false)
    setStartTime(null)
  }, [keys])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [finished])

  const elapsedSec = useMemo(
    () => (startTime && now ? Math.round((now - startTime) / 100) / 10 : 0),
    [now, startTime],
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
      const k = e.key.toLowerCase()
      setPressed((p) => ({ key: k, tick: p.tick + 1 })) // 押したキーを沈み込ませる
      if (e.key.toLowerCase() === target) {
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        setWrongKey(null)
        if (index >= targets.length - 1) setFinished(true)
        else setIndex((i) => i + 1)
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
        setWrongKey(e.key.toLowerCase()) // 押した（誤った）キーを記録して枠を光らせる
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, target, index, targets.length, onExit, restart])

  return {
    target,
    index,
    total: targets.length,
    mistakes,
    hasError,
    wrongKey,
    pressed,
    elapsedSec,
    finished,
    restart,
    targets,
  }
}
