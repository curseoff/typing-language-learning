// PWA の Service Worker 登録と「更新あり」検知（本番ビルドのみ）。
// domain/UI に依存しないブラウザ API 配線（infrastructure）。更新を検知したら
// onUpdate(applyUpdate) を呼ぶ。UI 側は applyUpdate() を「更新」ボタンに繋ぐだけでよい。
//
// 更新フロー：新 SW は install 後 waiting で待機（sw.js は install で skipWaiting しない）。
//   applyUpdate() → waiting.postMessage('SKIP_WAITING') → 新 SW が activate →
//   controllerchange → 一度だけ location.reload() で新 shell に切り替わる。
// dev（PROD でない）や serviceWorker 非対応環境では何もしない（従来どおり無効）。
export function registerServiceWorker({ onUpdate } = {}) {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', async () => {
    let registration
    try {
      registration = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href)
    } catch {
      return // 登録失敗は無視（PWA 無しの通常動作にフォールバック）
    }

    // 更新適用後（新 SW が制御を取った瞬間）に一度だけリロードして新 shell を反映する。
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return // 多重リロード防止
      reloading = true
      window.location.reload()
    })

    // waiting 中の新 SW をトーストに通知する。「更新」押下で SKIP_WAITING を送る。
    const notify = (waiting) => {
      if (!waiting || typeof onUpdate !== 'function') return
      onUpdate(() => waiting.postMessage('SKIP_WAITING'))
    }

    // 既に更新待ちの SW がある（前セッションで検知済み・controller あり＝初回ではない）。
    if (registration.waiting && navigator.serviceWorker.controller) {
      notify(registration.waiting)
    }

    // 新しい版が見つかったら、installed になった時点で通知する。
    // ただし controller が居る時のみ＝初回インストールではなく「更新」の時だけトーストを出す。
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notify(registration.waiting || installing)
        }
      })
    })
  })
}
