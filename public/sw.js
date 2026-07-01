// Service Worker：オフライン動作・瞬断耐性・再訪時の再DL回避のためのキャッシュ。
// 同一オリジンの GET を Stale-While-Revalidate でキャッシュ（表示は即・裏で更新）。
//   - content.sqlite3 / .wasm など大きい配布物は data キャッシュへ
//   - HTML/JS/CSS などアプリシェルは shell キャッシュへ
// バージョンを上げると activate 時に旧キャッシュを掃除する。
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const DATA = `data-${VERSION}`

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 同一オリジンのみキャッシュ対象

  const isData = /content\.sqlite3$|\.wasm$/.test(url.pathname)
  event.respondWith(staleWhileRevalidate(event, isData ? DATA : SHELL))
})

// キャッシュがあれば即返し、裏で取得して更新する。オフライン時はキャッシュで動く。
async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(event.request)
  const network = fetch(event.request).then((res) => {
    if (res && res.ok) cache.put(event.request, res.clone())
    return res
  })
  event.waitUntil(network.catch(() => {})) // 背景更新（失敗は無視）
  return cached || network
}
