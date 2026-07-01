// PWA の実挙動をヘッドレス Chrome で自動検証する（ローカル専用・CI 非組込）。
// 私（司令塔）が対話 Chrome で毎回手でやっている確認を Bash 一発で再現する：
//   - Service Worker が登録され、ページを制御している（controller が付く）
//   - shell-v1 に起動必須の小資産（/・CSS・index-*.js・manifest・icon）が揃う
//   - data-v1 に大物（content.sqlite3・sqlite3-*.wasm）が入る
// dist/ を preview で配信し、単語モードを一度プレイして SQLite/wasm 取得を促してから判定する。
//
// 使い方:
//   npm run build && npm run check:pwa
//   CHROME_PATH=/path/to/chrome npm run check:pwa
//
// Chromium は同梱せず（puppeteer-core）、システムの Chrome を再利用する。
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

// page.evaluate のコールバックはブラウザ文脈で実行される（caches/location/document はそこの global）。
/* global caches, location, document */

const OVERALL_TIMEOUT_MS = 30_000 // 全体の上限。無限待ちを防ぐ。

// 1) Chrome 実行パスを解決する。環境変数優先、無ければ macOS 既定。
function resolveChrome() {
  const cand =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (!existsSync(cand)) {
    console.error(
      `✖ Chrome が見つかりません: ${cand}\n  CHROME_PATH=/path/to/chrome を設定してください。`,
    )
    process.exit(1)
  }
  return cand
}

// 空きポートを OS に選ばせる（5173＝本人 dev は使わない。43xx 台を起点に探す）。
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.on('error', reject)
    srv.listen(4300, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

// preview を子プロセスで起動し、HTTP 200 になるまでポーリングする。
async function startPreview(port) {
  const child = spawn(
    'npx',
    ['vite', 'preview', '--port', String(port), '--strictPort'],
    { stdio: 'ignore' },
  )
  const base = `http://localhost:${port}`
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(base)
      if (res.ok) return { child, base }
    } catch {
      // まだ起動していない
    }
    await sleep(300)
  }
  child.kill()
  throw new Error('preview が起動しませんでした')
}

// ブラウザ内でキャッシュ内容を集計し、不足項目を洗い出す。
// Vary: Origin により strict match が外れるため ignoreVary で判定する。
async function inspectCaches(page) {
  return page.evaluate(async () => {
    const shell = await caches.open('shell-v1')
    const data = await caches.open('data-v1')

    // URL 文字列で存在判定（ignoreVary/ignoreSearch）。
    const hasUrl = async (cache, url) =>
      !!(await cache.match(url, { ignoreVary: true, ignoreSearch: true }))
    // キャッシュ済みキーのパス名を正規表現でパターン一致判定（ハッシュ付き資産向け）。
    const hasPattern = async (cache, re) => {
      const keys = await cache.keys()
      return keys.some((r) => re.test(new URL(r.url).pathname))
    }

    const origin = location.origin
    const missing = []

    // shell: 起動に必須の小資産
    if (!(await hasUrl(shell, `${origin}/`))) missing.push('shell:/')
    if (!(await hasPattern(shell, /\.css$/))) missing.push('shell:*.css')
    if (!(await hasPattern(shell, /\/index-[^/]*\.js$/))) missing.push('shell:index-*.js')
    if (!(await hasUrl(shell, `${origin}/manifest.webmanifest`)))
      missing.push('shell:manifest.webmanifest')
    if (!(await hasUrl(shell, `${origin}/icon.svg`))) missing.push('shell:icon.svg')

    // data: 大物
    if (!(await hasUrl(data, `${origin}/content.sqlite3`))) missing.push('data:content.sqlite3')
    if (!(await hasPattern(data, /sqlite3-[^/]*\.wasm$/))) missing.push('data:sqlite3-*.wasm')

    const count = async (cache) => (await cache.keys()).length
    return { missing, shellCount: await count(shell), dataCount: await count(data) }
  })
}

// 単語モードを起動して SQLite/wasm 取得を促す。DOM テキストからボタンを引く。
async function playWords(page) {
  // 「単語」種類タブ（テキストに「単語」を含み「例文」を含まない）を押す。
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const tab = btns.find((b) => b.textContent.includes('単語') && !b.textContent.includes('例文'))
    if (tab) tab.click()
  })
  await sleep(200)
  // 「スタート」を押す。
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const start = btns.find((b) => b.textContent.trim() === 'スタート')
    if (start) start.click()
  })
  await sleep(1500) // SQLite/wasm の取得・キャッシュ投入を待つ
}

async function main() {
  const executablePath = resolveChrome()
  if (!existsSync('dist/index.html')) {
    console.error('✖ dist/ が見つかりません。先に npm run build を実行してください。')
    process.exit(1)
  }

  const port = await freePort()
  const { child, base } = await startPreview(port)
  let browser
  try {
    browser = await puppeteer.launch({ headless: 'new', executablePath })
    const page = await browser.newPage()
    await page.goto(base, { waitUntil: 'load' })

    // SW 登録・制御を待つ。controller が付かなければ 1 回リロードして再確認。
    await page.evaluate(() => navigator.serviceWorker.ready)
    let controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
    if (!controlled) {
      await page.reload({ waitUntil: 'load' })
      await page.evaluate(() => navigator.serviceWorker.ready)
      controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
    }
    if (!controlled) throw new Error('Service Worker がページを制御していません（controller なし）')

    // 教材ロードを発火させてから、少し待ってキャッシュを確認する。
    await playWords(page)

    let { missing, shellCount, dataCount } = await inspectCaches(page)
    // data 群は activate 後の背景先読み＋SWR で少し遅れることがある。数回リトライ。
    for (let i = 0; i < 6 && missing.length; i++) {
      await sleep(500)
      ;({ missing, shellCount, dataCount } = await inspectCaches(page))
    }

    if (missing.length) {
      console.error(`✖ PWA: キャッシュに不足があります → ${missing.join(', ')}`)
      console.error(`  （shell ${shellCount}件 / data ${dataCount}件 キャッシュ済み）`)
      process.exit(1)
    }
    console.log(`✓ PWA: SW制御中・shell ${shellCount}件/data ${dataCount}件キャッシュ済み`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    child.kill()
  }
}

// 全体タイムアウト。超過したら失敗で打ち切る（子プロセスは finally で片付く想定）。
const timer = setTimeout(() => {
  console.error(`✖ PWA: ${OVERALL_TIMEOUT_MS / 1000}秒でタイムアウトしました。`)
  process.exit(1)
}, OVERALL_TIMEOUT_MS)
timer.unref()

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`✖ PWA: ${err.message}`)
    process.exit(1)
  },
)
