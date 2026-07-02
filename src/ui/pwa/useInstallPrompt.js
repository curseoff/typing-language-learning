import { useSyncExternalStore } from 'react'
import { canInstall, subscribeInstall } from '../../infrastructure/pwa/installPrompt.js'

// PWA インストール導線を出せるか(boolean)を購読して返すフック。
// 購読・解除は useSyncExternalStore が面倒を見る（unmount で subscribeInstall の解除関数を呼ぶ）。
// getServerSnapshot は常に false（SSR/非対応環境では導線を出さない＝安全側）。
export function useInstallPrompt() {
  return useSyncExternalStore(subscribeInstall, canInstall, () => false)
}
