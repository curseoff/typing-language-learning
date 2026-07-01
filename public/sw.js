// Service Worker：オフライン動作・瞬断耐性・再訪時の再DL回避のためのキャッシュ。
// 同一オリジンの GET を Stale-While-Revalidate でキャッシュ（表示は即・裏で更新）。
//   - content.sqlite3 / .wasm など大きい配布物は data キャッシュへ
//   - HTML/JS/CSS などアプリシェルは shell キャッシュへ
// さらに precache-manifest.json（ビルド時生成）を読んで先読みする：
//   - install で shell 群（起動必須の小資産）を addAll → 初回訪問からオフライン起動可能
//   - activate 後に data 群（11MB級の大物）を背景で best-effort 先読み（起動はブロックしない）
// バージョンを上げると activate 時に旧キャッシュを掃除する。
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const DATA = `data-${VERSION}`
const MANIFEST = './precache-manifest.json'

self.addEventListener('install', (event) => {
  // shell 群は小さいので install をブロックして先読みする（取得失敗時も install は続行）。
  event.waitUntil(
    (async () => {
      try {
        const manifest = await (await fetch(MANIFEST, { cache: 'no-cache' })).json()
        const cache = await caches.open(SHELL)
        await cache.addAll(manifest.shell)
      } catch {
        // manifest 取得やプリキャッシュに失敗しても起動を妨げない（従来の SWR で回復）。
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
  // data 群（大物）は重いので activate をブロックせず、浮いた非同期で個別に先読みする。
  void (async () => {
    try {
      const manifest = await (await fetch(MANIFEST, { cache: 'no-cache' })).json()
      const cache = await caches.open(DATA)
      for (const u of manifest.data) {
        try {
          await cache.add(u)
        } catch {
          // 個別失敗は無視（次回 fetch 時に SWR で補完される）。
        }
      }
    } catch {
      // manifest 取得失敗は無視。
    }
  })()
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
