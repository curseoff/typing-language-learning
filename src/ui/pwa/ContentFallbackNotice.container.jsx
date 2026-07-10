import { useState } from 'react'
import { useContentFallback } from './useContentFallback.js'

// 教材（SQLite/wasm）の読込に失敗し生成物 .js へフォールバックしたときだけ、控えめに告知する。
// 学習は継続できるが一部の表示が簡易になりうることを穏やかに伝える。SQLite 側が復活すれば
// 再読み込みで解消することが多いのでその旨も添える。role="status"/aria-live="polite" で
// スクリーンリーダーにも穏やかに通知する。「閉じる」でこのセッション中は消せる。
export default function ContentFallbackNotice() {
  const fallback = useContentFallback()
  const [dismissed, setDismissed] = useState(false)
  if (!fallback || dismissed) return null

  return (
    <div className="app-notice content-fallback-notice" role="status" aria-live="polite">
      <span className="app-notice__msg">
        一部の教材を簡易表示しています。再読み込みで直る場合があります
      </span>
      <button
        className="app-notice__close"
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  )
}
