// 初回ロードのエントリJS（dist/assets/index-*.js）のサイズ予算チェック。
// 全コンテンツを静的 import に戻す等で初回バンドルが肥大化したらCIで落とす。
import { readdirSync, statSync } from 'node:fs'

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB || 2048) // 初回エントリの上限
const dir = 'dist/assets'

let entry
try {
  entry = readdirSync(dir).find((f) => /^index-.*\.js$/.test(f))
} catch {
  console.error('✖ dist/assets が見つかりません。先に npm run build を実行してください。')
  process.exit(1)
}
if (!entry) {
  console.error('✖ エントリ index-*.js が見つかりません。')
  process.exit(1)
}
const kb = statSync(`${dir}/${entry}`).size / 1024
const msg = `初回エントリ ${entry}: ${kb.toFixed(1)} KB（予算 ${BUDGET_KB} KB）`
if (kb > BUDGET_KB) {
  console.error(`✖ バンドル予算超過: ${msg}\n  大きいコンテンツは遅延 import（src/content/wordSentences/index.js のように）にしてください。`)
  process.exit(1)
}
console.log(`✓ ${msg}`)
