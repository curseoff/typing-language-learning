import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service Worker 登録（本番ビルドのみ。dev では HMR 干渉を避けて無効）。
// オフライン動作・瞬断耐性・再訪時の再DL回避のため content.sqlite3/wasm/シェルをキャッシュする。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {})
  })
}
