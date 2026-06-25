// 全タブのトップ画面をヘッドレスChromeで撮影し、1枚のコンタクトシートにまとめる。
// 「各画面を開いて見る」目視確認を1枚のチラ見に置き換える。
//
// 使い方:
//   npm run screenshots                 # build → preview → 撮影 → /tmp/app-shots/contact.png
//   npm run screenshots -- --no-build   # 既存の dist を使う
//   CHROME="/path/to/chrome" npm run screenshots
//
// 出力: <dir>/<tab>.png（各タブ）と <dir>/contact.png（一覧）。

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const has = (n) => process.argv.includes(`--${n}`)

const PORT = Number(arg('port', '4188'))
const DIR = arg('dir', '/tmp/app-shots')
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TABS = [
  { key: 'review', label: '復習' },
  { key: 'wsent', label: '単語例文' },
  { key: 'words', label: '単語' },
  { key: 'dict', label: '英英辞典' },
  { key: 'story', label: '物語' },
  { key: 'touch', label: 'タッチタイピング' },
]

if (!existsSync(CHROME)) {
  console.error(`✖ Chrome が見つかりません: ${CHROME}\n  CHROME=... で指定してください。`)
  process.exit(1)
}
mkdirSync(DIR, { recursive: true })

const shot = (url, out, size = '1200,900') =>
  execFileSync(CHROME, [
    '--headless=new',
    '--hide-scrollbars',
    '--disable-gpu',
    `--window-size=${size}`,
    `--screenshot=${out}`,
    '--virtual-time-budget=3500',
    url,
  ], { stdio: 'ignore' })

// 1) ビルド
if (!has('no-build')) {
  console.log('① build…')
  execFileSync('npm', ['run', 'build'], { stdio: 'ignore' })
}

// 2) preview 起動
console.log(`② preview :${PORT} 起動…`)
const server = spawn('npm', ['run', 'preview', '--', '--port', String(PORT)], { stdio: 'ignore' })
const base = `http://localhost:${PORT}`
try {
  // 起動待ち
  let up = false
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(base)
      up = true
      break
    } catch {
      await sleep(300)
    }
  }
  if (!up) throw new Error('preview が起動しませんでした')

  // 3) 各タブを撮影
  console.log('③ 撮影…')
  for (const t of TABS) {
    shot(`${base}/?tab=${t.key}`, `${DIR}/${t.key}.png`)
    console.log(`   - ${t.label} (${t.key}.png)`)
  }

  // 4) コンタクトシート（HTMLをグリッド表示して再撮影）
  const cells = TABS.map(
    (t) =>
      `<figure><figcaption>${t.label}</figcaption><img src="${t.key}.png"></figure>`,
  ).join('\n')
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0b1020;font-family:sans-serif;padding:16px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    figure{margin:0;background:#11182c;border-radius:10px;overflow:hidden}
    figcaption{color:#cbd5e1;font-weight:700;padding:8px 12px}
    img{width:100%;display:block;border-top:1px solid #1f2a44}
  </style><div class="grid">${cells}</div>`
  writeFileSync(`${DIR}/contact.html`, html)
  shot(`file://${DIR}/contact.html`, `${DIR}/contact.png`, '1280,1700')
  console.log(`\n✓ 一覧: ${DIR}/contact.png（個別: ${DIR}/<tab>.png）`)
} finally {
  server.kill()
}
process.exit(0)
