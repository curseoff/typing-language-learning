// 「最初の打鍵から60秒で終了」の共通タイマー。now の刻み・60秒到達の1回限り発火・
// 経過秒/速度計算を集約し、各ゲームフックの重複を排除する。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'

// active: 時間を刻む条件（marathon は active prop、他は !finished）
// startTime: 最初の打鍵時刻（呼び出し側が保持・null は未開始）
// onTimeout(endTime, startedAt): 60秒到達で1回だけ。setTimeout(…,0) で次tickへ遅延。
export function useCountdownTimer({ active, startTime, onTimeout }) {
  const [now, setNow] = useState(0)
  const firedRef = useRef(false) // onTimeout を一度だけ発火するガード
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout // 最新の onTimeout を参照（依存配列に入れない）

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [active])

  // startTime が null に戻ったら（restart）再武装する
  useEffect(() => {
    if (startTime === null) firedRef.current = false
  }, [startTime])

  // 最初の打鍵から60秒で1回だけ onTimeout（effect 内同期 setState のカスケード回避で setTimeout 遅延）
  useEffect(() => {
    if (!active || startTime === null || firedRef.current) return
    if (now - startTime < TIME_LIMIT_MS) return
    firedRef.current = true
    const endTime = startTime + TIME_LIMIT_MS
    setTimeout(() => onTimeoutRef.current(endTime, startTime), 0)
  }, [active, now, startTime])

  const started = startTime !== null
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTime) / 100) / 10
  }, [started, now, startTime])
  const liveSpeed = useCallback(
    (count) => {
      if (!started || now === 0) return 0
      const min = (now - startTime) / 60000
      return min > 0 ? Math.round(count / min) : 0
    },
    [started, now, startTime],
  )

  return { now, elapsedSec, liveSpeed }
}
