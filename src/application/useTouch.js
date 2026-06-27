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
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [startTime, setStartTime] = useState(null)

  const target = targets[index]

  const restart = useCallback(() => {
    setTargets(buildDrill(keys))
    setIndex(0)
    setMistakes(0)
    setHasError(false)
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
      if (e.key.toLowerCase() === target) {
        const _t = performance.now()
        setStartTime((p) => p ?? _t)
        setHasError(false)
        if (index >= targets.length - 1) setFinished(true)
        else setIndex((i) => i + 1)
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
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
    elapsedSec,
    finished,
    restart,
    done: targets.slice(0, index),
    upcoming: targets.slice(index + 1, index + 9),
  }
}
