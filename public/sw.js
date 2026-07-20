// Service Worker：オフライン動作・瞬断耐性・再訪時の再DL回避のためのキャッシュ。
// 同一オリジンの GET を Stale-While-Revalidate でキャッシュ（表示は即・裏で更新）。
//   - content.sqlite3 / .wasm など大きい配布物は data キャッシュへ
//   - HTML/JS/CSS などアプリシェルは shell キャッシュへ
// DATA/SHELL の振り分けは precache-manifest.json の data 集合（gen-precache が唯一の出所）に
// 一本化する（#173 方式a）＝正規表現の二重定義を排し drift を防ぐ。manifest 取得に失敗した時だけ
// 従来の正規表現（sqlite3/wasm）に安全側フォールバックする。
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
  // ここで skipWaiting() はしない：更新時は新 SW を waiting のまま待機させ、ユーザーが
  // 更新トーストの「更新」を押した時（message: SKIP_WAITING）だけ切り替える。
  //   → 「古い shell と新しい data の混在」や学習中の突然のリロード事故を防ぐ。
  // 初回訪問（既存 controller が無い）は置き換える相手が居ないので waiting フェーズは発生せず、
  // そのまま activate→clients.claim() で即制御される（＝初回オフライン起動は従来どおり維持）。
  event.waitUntil(
    (async () => {
      try {
        const manifest = await (await fetch(MANIFEST, { cache: 'no-cache' })).json()
        const cache = await caches.open(SHELL)
        await cache.addAll(manifest.shell)
      } catch {
        // manifest 取得やプリキャッシュに失敗しても起動を妨げない（従来の SWR で回復）。
      }
    })(),
  )
})

// ページから SKIP_WAITING を受けたら待機中の新 SW を有効化する（更新トーストの「更新」押下で送られる）。
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
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

// manifest.data の URL 集合（pathname）を遅延ロードして保持する（fetch ルーティングの単一ソース）。
// SW 再起動でメモリは消えるので初回 fetch で取得。取得失敗時は null を返し、呼び出し側で
// 正規表現フォールバックに切り替える（次回 fetch でリトライできるよう promise は破棄する）。
let dataUrlSetPromise = null
function loadDataUrlSet() {
  if (!dataUrlSetPromise) {
    dataUrlSetPromise = (async () => {
      try {
        const manifest = await (await fetch(MANIFEST, { cache: 'no-cache' })).json()
        // 相対パス（'content.sqlite3' 等）を scope 基準の絶対 pathname へ解決して集合化する。
        return new Set((manifest.data || []).map((p) => new URL(p, self.registration.scope).pathname))
      } catch {
        dataUrlSetPromise = null // 失敗は次回 fetch でリトライ
        return null
      }
    })()
  }
  return dataUrlSetPromise
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 同一オリジンのみキャッシュ対象

  // #357: ナビゲーション（deep-link の直アクセス）は cache-first で app-shell を即返し、
  // 背景でネットワーク更新する。SPA なので shell は全ルート共通＝キャッシュ済み shell を
  // 返せばどの深いパス（/…/story/travel）でも SPA が起動して復元する。
  // navigate 以外は従来どおり（SWR）。
  if (req.mode === 'navigate') {
    event.respondWith(navigationFallback(event))
    return
  }

  event.respondWith(routeAndRespond(event, url))
})

// ナビゲーション応答：cache-first で app-shell を即返し、背景でネットワーク更新する。
// SPA なので shell は全ルート共通＝キャッシュ済み shell を返せばどのパスでも SPA が起動する。
//   - オンライン起動：キャッシュ shell を即描画（HTML 往復待ちなし）＋背景で shell を更新。
//     鮮度は既存の版管理＋UpdateToast が担保する。
//   - オフライン deep-link：キャッシュ shell 即返しで成立。
//   - 未キャッシュ（初回・SW 未インストール）はネットワーク、失敗時は 404.html を最後の砦に。
async function navigationFallback(event) {
  const cache = await caches.open(SHELL)
  const scope = self.registration.scope
  // Vary: Origin 等で strict match が外れるのを回避（実キャッシュは scope 直下＝origin+BASE）。
  const opts = { ignoreVary: true, ignoreSearch: true }
  const cachedShell =
    (await cache.match(new URL('./', scope).href, opts)) ||
    (await cache.match(new URL('index.html', scope).href, opts)) ||
    (await cache.match(new URL('404.html', scope).href, opts))
  if (cachedShell) {
    // cache-first：即返し。背景でネットワークから shell（root）を取得して更新（失敗は無視）。
    // #422 取得先は常に shell URL（scope 直下 './'）。deep-link の event.request
    // （例 /words/1/すべて/en）は静的ホストで 404 になり shell 更新に使えないうえ、
    // DevTools に紛らわしい 404 を残すため。
    const shellUrl = new URL('./', scope).href
    event.waitUntil(
      fetch(shellUrl)
        .then((res) => {
          if (res && res.ok) return cache.put(shellUrl, res.clone())
        })
        .catch(() => {}),
    )
    return cachedShell
  }
  // 未キャッシュ（初回・SW 未インストール）はネットワーク、失敗時は 404.html 相当を最後の砦に。
  try {
    return await fetch(event.request)
  } catch {
    return (await cache.match(new URL('404.html', scope).href, opts)) || Response.error()
  }
}

// manifest.data のメンバーシップで DATA/SHELL を決めて応答する。
// 集合を取れない時は従来の正規表現（sqlite3/wasm）へフォールバック（安全側）。
async function routeAndRespond(event, url) {
  const dataUrls = await loadDataUrlSet()
  const isData = dataUrls
    ? dataUrls.has(url.pathname)
    : /content\.sqlite3$|\.wasm$/.test(url.pathname)
  return staleWhileRevalidate(event, isData ? DATA : SHELL)
}

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
