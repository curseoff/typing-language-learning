import { useSyncExternalStore } from 'react'
import { subscribeContentFallback, hasContentFallback } from '../../content/contentFallback.js'

// 教材（SQLite/wasm）の読込失敗→生成物 .js フォールバックが起きたか(boolean)を購読するフック。
// 購読・解除は useSyncExternalStore が面倒を見る（unmount で subscribeContentFallback の解除関数を呼ぶ）。
// getSnapshot は boolean の primitive（hasContentFallback）を渡す（counts オブジェクトは毎回新規生成され
// 無限ループになるため getSnapshot には使わない）。getServerSnapshot は常に false（未発生扱い＝安全側）。
export function useContentFallback() {
  return useSyncExternalStore(subscribeContentFallback, hasContentFallback, () => false)
}
