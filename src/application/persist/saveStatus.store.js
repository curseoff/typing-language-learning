// #399 保存状態バッジ: このタブが記録を保存できているかの状態源（application 層）。
// persistNotice.store と同型の参照安定ストア：setSaveStatus で状態を更新→ subscribe した UI
// （useSyncExternalStore）へ通知する。DOM/infra 非依存の素の状態ストア（テストで被覆＝計測対象）。
//
// state = { role, reason }
//   role: 'primary'（主タブ＝保存中）| 'secondary'（副タブ＝閲覧のみ）|
//         'memory'（非永続へ縮退）| 'unknown'（起動中・未確定）
//   reason: 縮退理由の安定コード（'no-opfs'/'no-worker'/'no-locks'/'forced-memory' 等）| null
// 真実源は main.jsx（memory 縮退）と multiTab.adapter（onRole 注入）が埋める。UI は
// saveStatusBadge.policy で level/reasonCode へ写像し、文言へ変換して表示する。

let status = { role: 'unknown', reason: null }
const listeners = new Set()

function notify() {
  for (const l of listeners) l()
}

// 保存状態をセットする。reason 省略は null 扱い。role・reason がともに現在値と等しければ
// no-op（通知しない・get の参照も不変＝useSyncExternalStore の無駄な再描画を避ける）。
// 変化時のみ新オブジェクトへ差し替え、全 listener へ通知する。
export function setSaveStatus({ role, reason = null }) {
  if (role === status.role && reason === status.reason) return
  status = { role, reason }
  notify()
}

// 現在の保存状態（参照安定なオブジェクト）。未確定は { role:'unknown', reason:null }。
export function getSaveStatus() {
  return status
}

// 保存状態の変化を購読する（UI バッジ用）。解除関数を返す（useSyncExternalStore が unmount 時に呼ぶ）。
export function subscribeSaveStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// テスト用に状態を初期化する（本番導線からは呼ばない）。
export function resetSaveStatus() {
  status = { role: 'unknown', reason: null }
  listeners.clear()
}
