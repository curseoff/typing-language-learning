// プレイ中・結果・記録の画面を自動撮影する（手動プレイ＋スクショ送付の往復を減らす）。
// dev サーバ（import.meta.env.DEV=true）相手に ?preview= を開き、ダミーデータで各画面を描画して撮る。
//
// 使い方:
//   npm run shots:play
//   CHROME="/path/to/chrome" npm run shots:play
// 出力: <dir>/play.png（単語例文プレイ）/ result.png（結果＝問題ごとの記録＋ランキング）

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const PORT = Number(arg('port', '5191'))
const DIR = arg('dir', '/tmp/app-shots')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// ?preview= の各画面（App の DEV 用トリガに対応）
const VIEWS = [
  { key: 'result', label: '結果（問題ごとの記録＋ランキング）' },
  { key: 'play', label: '単語例文プレイ（フロー表示）' },
]

if (!existsSync(CHROME)) {
  console.error(`✖ Chrome が見つかりません: ${CHROME}\n  CHROME=... で指定してください。`)
  process.exit(1)
}
mkdirSync(DIR, { recursive: true })

const shot = (url, out) =>
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--hide-scrollbars',
      '--disable-gpu',
      '--window-size=1200,1400',
      `--screenshot=${out}`,
      '--virtual-time-budget=5000',
      url,
    ],
    { stdio: 'ignore' },
  )

console.log(`① dev サーバ :${PORT} 起動…`)
const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
const base = `http://localhost:${PORT}`
try {
  let up = false
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(base)
      up = true
      break
    } catch {
      await sleep(300)
    }
  }
  if (!up) throw new Error('dev サーバが起動しませんでした')

  console.log('② 撮影…')
  for (const v of VIEWS) {
    shot(`${base}/?preview=${v.key}`, `${DIR}/${v.key}.png`)
    console.log(`   - ${v.label} (${v.key}.png)`)
  }
  console.log(`\n✓ 出力: ${DIR}/result.png, ${DIR}/play.png`)
} finally {
  server.kill()
}
process.exit(0)
