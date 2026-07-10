import { useSyncExternalStore } from 'react'
import {
  subscribePersistNotice,
  getPersistNotice,
} from '../../application/persist/persistNotice.store.js'

// 永続化の縮退/復元の告知種別（'fallback'|'restored'|null）を購読するフック（#268 Phase5a）。
// useContentFallback と同じく useSyncExternalStore で購読・解除を任せる。getSnapshot は参照安定な
// primitive（文字列 or null）を返す（オブジェクトを返すと毎回新規で無限ループになるため使わない）。
// getServerSnapshot は常に null（未発生扱い＝安全側）。
export function usePersistNotice() {
  return useSyncExternalStore(subscribePersistNotice, getPersistNotice, () => null)
}
