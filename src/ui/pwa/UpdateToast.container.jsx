import { useCallback, useEffect, useState } from 'react'
import { registerServiceWorker } from '../../infrastructure/pwa/registerSW.adapter.js'

// PWA 更新通知トースト。新しい版を検知したら画面下部に控えめに告知し、
// 「更新」で待機中の新 SW に切り替え（→ 自動リロード）、「後で」で閉じる。
// SW 登録と更新検知は infrastructure/registerSW に委譲し、ここは表示だけを持つ。
// dev や SW 非対応では registerServiceWorker が何もしないためトーストは出ない。
export default function UpdateToast() {
  // apply: 更新を適用する関数（更新検知後にセットされる）。null の間はトースト非表示。
  const [apply, setApply] = useState(null)

  useEffect(() => {
    registerServiceWorker({
      // 二重関数（() => fn）で「関数を state に格納」する（setState は関数だと更新関数扱いになるため）。
      onUpdate: (applyUpdate) => setApply(() => applyUpdate),
    })
  }, [])

  const onUpdate = useCallback(() => {
    apply?.()
    setApply(null) // 押下後は隠す（controllerchange でリロードされる）
  }, [apply])

  if (!apply) return null

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <span className="update-toast__msg">新しいバージョンがあります</span>
      <div className="update-toast__actions">
        <button className="update-toast__update" onClick={onUpdate}>
          更新
        </button>
        <button className="update-toast__later" onClick={() => setApply(null)}>
          後で
        </button>
      </div>
    </div>
  )
}
