import { useState } from 'react'
import { usePersistNotice } from './usePersistNotice.js'

// #268 [#264 Phase5a] 永続化の縮退/復元を穏やかに告知する（ContentFallbackNotice に倣う控えめな帯）。
//   'fallback' … sqlite を要求したが能力不足で local へ縮退した（＝これまでどおり保存を続けている）。
//   'restored' … 起動時に破損を検知し、最近の内部バックアップから自動復元した。
// どちらも学習は継続できるトーンで伝える。既定 local（意図的な local）では notice=null＝何も出さない。
// role="status"/aria-live="polite" でスクリーンリーダーにも穏やかに通知。「×」でこのセッション中は消せる。
const MESSAGES = {
  fallback: '保存の高速化に対応できず、これまでどおり保存しています',
  restored: 'データの一部を最近のバックアップから復元しました',
}

export default function PersistNotice() {
  const notice = usePersistNotice()
  const [dismissed, setDismissed] = useState(false)
  if (!notice || dismissed) return null

  return (
    <div className="app-notice persist-notice" role="status" aria-live="polite">
      <span className="app-notice__msg">{MESSAGES[notice]}</span>
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
