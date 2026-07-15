// タッチタイピング練習（container）：useTouch（状態機械・キー入力配線・タイマー）を呼び、
// 完了時の記録保存 effect を持つ。表示の骨格は @tll/ui の TouchView（presenter）。
// 外部 API（level/levelLabel/mode/modeLabel/onRecord/onExit）は従来どおり維持。
import { useEffect, useRef } from 'react'
import { TouchView as TouchViewPresenter } from '@tll/ui'
import { useTouch } from '../../application/useTouch.js'
import { makeScoreRecord } from '../../domain/records/scoreRecord.vo.js'

export default function TouchView({ level, levelLabel, mode, modeLabel, onRecord, onExit }) {
  const t = useTouch({ level, onExit })
  const showTarget = mode !== 'hard' // むずかしいは打つキーをハイライトしない

  // 完了時に記録を1回だけ保存（速い順ランキングに積む）。restart で再び保存できるようリセット。
  const saved = useRef(false)
  useEffect(() => {
    if (!t.finished) {
      saved.current = false
      return
    }
    if (saved.current) return
    saved.current = true
    // 採点（speed/accuracy/seconds）は domain の makeScoreRecord に集約（canonical・ms 基準）。#412
    // 本フックは ms を持たない（elapsedSec のみ）ので秒×1000 を elapsedMs として渡す＝丸めは従来と同値。
    // keys＝正しく打ったキー数（タイピング数・主指標）。凍結を plain 展開して従来の record 形状を保つ。
    onRecord?.({
      ...makeScoreRecord({
        keys: t.typedKeys,
        mistakes: t.mistakes,
        elapsedMs: t.elapsedSec * 1000,
        meta: { source: 'touch', mode, rank: level, date: new Date().toLocaleString('ja-JP') },
      }),
    })
    // 完了フラグ立ち上がりで保存。値は当該レンダーのものを使う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.finished])

  return (
    <TouchViewPresenter
      levelLabel={levelLabel}
      modeLabel={modeLabel}
      showTarget={showTarget}
      targets={t.targets}
      index={t.index}
      target={t.target}
      typedKeys={t.typedKeys}
      liveSpeed={t.liveSpeed}
      mistakes={t.mistakes}
      elapsedSec={t.elapsedSec}
      hasError={t.hasError}
      wrongKey={t.wrongKey}
      pressed={t.pressed}
      finished={t.finished}
      onRestart={t.restart}
      onExit={onExit}
    />
  )
}
