// ローマ字入力練習の状態機械（最初の打鍵から60秒で終了。ドリルが尽きたら継ぎ足す）。
// 入力モデルは1かなずつ：現在かなに対し英字を1文字ずつ受理判定し、綴り切ったら次のかなへ。
// useTouch と同じイディオム（keydown 配線＋useCountdownTimer 60秒＋ドリル継ぎ足し＋finished）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { kanaOf } from '@tll/core'
import { buildKanaDrill } from '../domain/romaji/drill.js'
import { acceptsRomaji, isKanaComplete } from '../domain/romaji/input.js'
import { useCountdownTimer } from './useCountdownTimer.js'
import { ROMAJI_LEVELS } from '../content/romaji.js'
import { playMiss } from '../infrastructure/sound.js'

export function useRomaji({ level, onExit }) {
  // レベル（行グループ）→ 出題かな集合。未知レベルは先頭へフォールバック。
  const kanaSet = useMemo(() => {
    const lv = ROMAJI_LEVELS.find((l) => l.key === level) ?? ROMAJI_LEVELS[0]
    return kanaOf(lv.rowIds)
  }, [level])

  const [targets, setTargets] = useState(() => buildKanaDrill(kanaSet))
  const [index, setIndex] = useState(0) // 確定したかな数（＝タイピング数）
  const [input, setInput] = useState('') // 現在かなのローマ字入力バッファ
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [wrongKey, setWrongKey] = useState(null) // 直近にミスタイプしたキー
  const [finished, setFinished] = useState(false)
  const [startTime, setStartTime] = useState(null)

  const current = targets[index] // 今打っているかな

  const restart = useCallback(() => {
    setTargets(buildKanaDrill(kanaSet))
    setIndex(0)
    setInput('')
    setMistakes(0)
    setHasError(false)
    setWrongKey(null)
    setFinished(false)
    setStartTime(null)
  }, [kanaSet])

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
          setIndex((i) => i + 1)
        } else {
          setInput(next)
        }
      } else {
        // 受理外＝ミス。バッファは伸ばさない（useTouch と同挙動）。
        setMistakes((m) => m + 1)
        playMiss()
        setHasError(true)
        setWrongKey(ch)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, current, input, index, targets.length, kanaSet, onExit, restart])

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
