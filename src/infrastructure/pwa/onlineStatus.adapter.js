// オンライン/オフライン検知の薄い配線（infrastructure）。React/DOM ロジックに依存しない
// ブラウザ API 購読ユーティリティ。navigator 不在（SSR/テスト）や onLine 未対応時は
// 「オンライン扱い」の安全側デフォルトを返す（PWA でオフラインでも学習は継続できるため、
// 判定不能を理由に不要な警告を出さない）。

// 現在オンラインかを返す。navigator 不在や onLine が boolean でなければ true（安全側）。
export function isOnline() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true
  return navigator.onLine
}

// online/offline イベントを購読し、変化のたびに listener() を呼ぶ。
// 戻り値は購読解除関数（呼ぶと登録した両リスナを解除）。window 不在時は no-op を返す。
export function subscribeOnline(listener) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}
