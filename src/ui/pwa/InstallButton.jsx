import { useCallback } from 'react'
import { useInstallPrompt } from './useInstallPrompt.js'
import { promptInstall } from '../../infrastructure/pwa/installPrompt.js'

// PWA を任意のタイミングでインストールできる「アプリとして追加」ボタン。
// beforeinstallprompt を捕捉できたとき（＝インストール可能）だけ表示する。押下でネイティブの
// プロンプトを出し、結果に関わらず deferredPrompt を消費するため canInstall が false になり
// 再レンダーで自動的に消える。既にインストール済み・非対応ブラウザでは useInstallPrompt が
// false のまま＝描画されない。
export default function InstallButton() {
  const installable = useInstallPrompt()

  const onClick = useCallback(() => {
    // outcome は使わない（消費で導線は自動的に消える）。await 不要のまま投げてよい。
    promptInstall()
  }, [])

  if (!installable) return null

  return (
    <button
      className="install-button"
      type="button"
      onClick={onClick}
      aria-label="アプリとして追加"
    >
      <span className="install-button__icon" aria-hidden="true">+</span>
      アプリとして追加
    </button>
  )
}
