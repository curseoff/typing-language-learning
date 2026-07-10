// ローマ字入力練習（container）：useRomaji（状態機械・キー入力配線・タイマー）を呼び、
// 完了時の記録保存 effect を持つ。表示の骨格は @tll/ui の RomajiView（presenter）。
import { useEffect, useRef } from 'react'
import { RomajiView as RomajiViewPresenter } from '@tll/ui'
import { toRomaji } from '@tll/core'
import { useRomaji } from '../../application/useRomaji.js'
import { ROMAJI_LEVELS } from '../../content/romaji.js'

export default function RomajiView({ level, levelLabel, mode, onRecord, onExit }) {
  const r = useRomaji({ level, onExit })
  const rowIds = (ROMAJI_LEVELS.find((l) => l.key === level) ?? ROMAJI_LEVELS[0]).rowIds

  // 完了時に記録を1回だけ保存（タイピング数＝かな数の多い順ランキングに積む）。
  const saved = useRef(false)
  useEffect(() => {
    if (!r.finished) {
      saved.current = false
      return
    }
    if (saved.current) return
    saved.current = true
    const seconds = r.elapsedSec
    const keys = r.keys // 正しく打ち切ったかな数＝タイピング数（主指標）
    const speed = seconds > 0 ? Math.round((keys / seconds) * 60) : 0
    const accuracy = keys + r.mistakes > 0 ? Math.round((keys / (keys + r.mistakes)) * 100) : 100
    onRecord?.({
      source: 'romaji',
      mode,
      rank: level,
      keys,
      speed,
      mistakes: r.mistakes,
      accuracy,
      seconds,
      date: new Date().toLocaleString('ja-JP'),
    })
    // 完了フラグ立ち上がりで保存。値は当該レンダーのものを使う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.finished])

  return (
    <RomajiViewPresenter
      levelLabel={levelLabel}
      rowIds={rowIds}
      current={r.current}
      targets={r.targets}
      index={r.index}
      input={r.input}
      romaji={toRomaji(r.current)}
      keys={r.keys}
      liveSpeed={r.liveSpeed}
      mistakes={r.mistakes}
      elapsedSec={r.elapsedSec}
      hasError={r.hasError}
      finished={r.finished}
      onRestart={r.restart}
      onExit={onExit}
    />
  )
}
