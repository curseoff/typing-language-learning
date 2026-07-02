// 効果音のミュート設定の永続化（localStorage）。
// 既定はオン（未設定なら鳴らす）＝ true を保存したときだけミュート。読み書きは例外を握りつぶす
// ベストエフォート（設定の失敗でタイピングを妨げない）。トグル UI が購読できるよう軽い pub/sub を持つ。

const STORAGE_KEY = 'sound-muted-v1'

// 変更通知の購読者集合（useSyncExternalStore 用）。
const listeners = new Set()

// 現在ミュートかを返す。未設定・破損・localStorage 不在なら false（＝既定オン・安全側で鳴らす）。
export function isSoundMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// ミュート設定を保存し、購読者へ通知する。保存失敗（プライベートモード等）は握りつぶす。
export function setSoundMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false')
  } catch {
    // 保存できなくても通知はする（UI 状態はセッション内で追従させる）
  }
  for (const fn of listeners) fn()
}

// ミュート設定の変化を購読する。戻り値は購読解除関数。
export function subscribeSoundMuted(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
