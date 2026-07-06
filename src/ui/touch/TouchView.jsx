// タッチタイピング練習（container）：useTouch（状態機械・キー入力配線・タイマー）を呼び、
// 完了時の記録保存 effect を持つ。表示の骨格は @tll/ui の TouchView（presenter）。
// 外部 API（level/levelLabel/mode/modeLabel/onRecord/onExit）は従来どおり維持。
import { useEffect, useRef } from 'react'
import { TouchView as TouchViewPresenter } from '@tll/ui'
import { useTouch } from '../../application/useTouch.js'

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
    const seconds = t.elapsedSec
    const keys = t.typedKeys // 正しく打ったキー数＝タイピング数（主指標）
    const speed = seconds > 0 ? Math.round((keys / seconds) * 60) : 0
    const accuracy = keys + t.mistakes > 0 ? Math.round((keys / (keys + t.mistakes)) * 100) : 100
    onRecord?.({
      source: 'touch',
      mode,
      rank: level,
      keys,
      speed,
      mistakes: t.mistakes,
      accuracy,
      seconds,
      date: new Date().toLocaleString('ja-JP'),
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
