import { useSyncExternalStore } from 'react'
import { isSoundMuted, subscribeSoundMuted } from '../../infrastructure/soundSettingsRepository.js'

// 効果音のミュート設定(boolean)を購読して返すフック。オフラインバナー(#177)と同じ
// useSyncExternalStore パターン。getServerSnapshot は false（既定オン＝鳴らす）を返す。
export function useSoundMuted() {
  return useSyncExternalStore(subscribeSoundMuted, isSoundMuted, () => false)
}
