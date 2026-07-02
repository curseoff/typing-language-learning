import { useOnlineStatus } from './useOnlineStatus.js'

// オフライン時のみ控えめに告知するバナー。PWA でシェル/教材をキャッシュ済みのため、
// ネット断でも学習は継続できることを伝える。オンライン復帰で自動的に消える。
// role="status" / aria-live="polite" でスクリーンリーダーにも穏やかに通知する。
export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner__dot" aria-hidden="true" />
      オフライン：学習は続けられます
    </div>
  )
}
