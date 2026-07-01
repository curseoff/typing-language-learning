import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service Worker の登録と更新検知は UI 側の <UpdateToast /> が担う
// （本番ビルドのみ。dev では HMR 干渉を避けて無効）。更新を検知したらトーストで告知し、
// ユーザーが「更新」を押したタイミングで新 SW へ切り替える。詳細は
// src/infrastructure/pwa/registerSW.js / src/ui/pwa/UpdateToast.jsx を参照。
