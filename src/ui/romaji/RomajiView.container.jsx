// ローマ字入力練習（container）：useRomaji（状態機械・キー入力配線・タイマー）を呼び、
// 完了時の記録保存 effect を持つ。表示の骨格は @tll/ui の RomajiView（presenter）。
import { useEffect, useRef } from 'react'
import { RomajiView as RomajiViewPresenter } from '@tll/ui'
import { toRomaji } from '@tll/core'
import { useRomaji } from '../../application/useRomaji.js'
import { makeScoreRecord } from '../../domain/records/scoreRecord.vo.js'
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
    // 採点（speed/accuracy/seconds）は domain の makeScoreRecord に集約（canonical・ms 基準）。#412
    // 本フックは ms を持たない（elapsedSec のみ）ので秒×1000 を elapsedMs として渡す＝丸めは従来と同値。
    // keys＝正しく打ち切ったかな数（タイピング数・主指標）。凍結を plain 展開して従来の record 形状を保つ。
    onRecord?.({
      ...makeScoreRecord({
        keys: r.keys,
        mistakes: r.mistakes,
        elapsedMs: r.elapsedSec * 1000,
        meta: { source: 'romaji', mode, rank: level, date: new Date().toLocaleString('ja-JP') },
      }),
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
