// 効果音トグル（container）：ミュート設定（localStorage）を購読し、切替ハンドラを組み立てて
// @tll/ui の SoundToggle（presenter）へ渡す。表示の骨格・SVG は presenter 側。
// 外部 API（props なし・固定表示）は従来どおり維持。
import { useCallback } from 'react'
import { SoundToggle as SoundToggleView } from '@tll/ui'
import { useSoundMuted } from './useSoundMuted.js'
import { setSoundMuted } from '../../infrastructure/soundSettingsRepository.js'

export default function SoundToggle() {
  const muted = useSoundMuted()
  const onToggle = useCallback(() => setSoundMuted(!muted), [muted])
  return <SoundToggleView muted={muted} onToggle={onToggle} />
}
