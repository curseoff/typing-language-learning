import { useSyncExternalStore } from 'react'
import { isOnline, subscribeOnline } from '../../infrastructure/pwa/onlineStatus.js'

// online/offline を購読して現在の接続状態(boolean)を返すフック。
// 購読・解除は useSyncExternalStore が面倒を見る（unmount で subscribeOnline の解除関数を呼ぶ）。
// getServerSnapshot は常に true（SSR/非対応環境ではオンライン扱い＝安全側デフォルト）。
export function useOnlineStatus() {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true)
}
