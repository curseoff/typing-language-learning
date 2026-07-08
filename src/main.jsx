import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import { resolvePersistBackend, chooseBackend } from './application/persist/backend.js'
import { initStorage } from './infrastructure/db/initStorage.js'
import { initSqlitePersistence } from './application/records.js'

// 永続化バックエンドを解決し、sqlite なら Worker を起動して起動時メモリ像を展開する（#266 Phase3a）。
// キルスイッチ既定は 'local'＝現行 localStorage（挙動不変）。sqlite は ?persist=sqlite 等でのみ有効。
// フェイルセーフ：どこで失敗しても例外を投げず local へ縮退し、render は必ず続行する（アプリを止めない）。
async function setupPersistence() {
  try {
    const params = new URLSearchParams(window.location.search)
    const desired = resolvePersistBackend({
      url: params.get('persist'),
      ls: localStorage.getItem('persist-backend'),
      env: import.meta.env.VITE_PERSIST_BACKEND,
    })
    const backend = chooseBackend({
      desired,
      opfsOk: !!(navigator.storage && 'getDirectory' in navigator.storage),
      workerOk: typeof Worker !== 'undefined',
      locksSupported: 'locks' in navigator,
    })
    if (backend !== 'sqlite') return // local はここで何もしない（現行の localStorage 経路）

    const handle = await initStorage() // 失敗時は null（initStorage が縮退）→ local へ
    if (!handle) return
    const image = await handle.hydrate()
    initSqlitePersistence(handle, image)
  } catch (e) {
    console.warn('[persist] 永続化の初期化に失敗。localStorage で続行します。', e)
  }
}

setupPersistence().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})

// Service Worker の登録と更新検知は UI 側の <UpdateToast /> が担う
// （本番ビルドのみ。dev では HMR 干渉を避けて無効）。更新を検知したらトーストで告知し、
// ユーザーが「更新」を押したタイミングで新 SW へ切り替える。詳細は
// src/infrastructure/pwa/registerSW.js / src/ui/pwa/UpdateToast.jsx を参照。
