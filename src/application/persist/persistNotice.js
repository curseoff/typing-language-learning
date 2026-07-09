// #268 [#264 Phase5a] 永続化の縮退/復元をユーザーへ穏やかに告知するための状態源（application 層）。
// 種類は 'fallback'（sqlite を要求したが local へ縮退）| 'restored'（破損から自動復元）| null（告知なし）。
// contentFallback.js と同じ購読モデル：setPersistNotice で状態を更新→ subscribe した UI（usePersistNotice）
// へ通知する。getSnapshot は参照安定な primitive（文字列 or null）を返す（useSyncExternalStore 用）。
// DOM/infra 非依存の素の状態ストア（テストで被覆＝計測対象）。

let notice = null // 'fallback' | 'restored' | null
const listeners = new Set()

function notify() {
  for (const l of listeners) l()
}

// 告知種別をセットする。既に 'restored' が立っていれば 'fallback' で上書きしない
// （復元＝より重要な事象を優先。同値なら通知しない＝無駄な再描画を避ける）。
export function setPersistNotice(kind) {
  if (kind === notice) return
  if (kind === 'fallback' && notice === 'restored') return
  notice = kind
  notify()
}

// 現在の告知種別（参照安定な primitive）。未発生は null。
export function getPersistNotice() {
  return notice
}

// 告知の変化を購読する（UI 告知用）。解除関数を返す（useSyncExternalStore が unmount 時に呼ぶ）。
export function subscribePersistNotice(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// テスト用に状態を初期化する（本番導線からは呼ばない）。
export function resetPersistNotice() {
  notice = null
  listeners.clear()
}
