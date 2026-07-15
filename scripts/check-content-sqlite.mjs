// 配信物 dist/assets/content-<hash>.sqlite3 のスモークチェック。
// ビルド後に「教材 DB が dist に載っていて、正しい SQLite ファイルである」ことを検証する。
// これで「デプロイに含まれず 404」「破損/途中切れ」を出荷前に検知する。
// #414：Vite の `?url` import で hash 付き asset（dist/assets/content-<hash>.sqlite3）になった。
// 実行: node scripts/check-content-sqlite.mjs（npm run check:content）
import { readFileSync, readdirSync } from 'node:fs'

const dir = new URL('../dist/assets/', import.meta.url)
let names
try {
  names = readdirSync(dir).filter((f) => /^content-.*\.sqlite3$/.test(f))
} catch {
  console.error('✗ dist/assets が見つかりません（先に npm run build を実行してください）')
  process.exit(1)
}
if (names.length === 0) {
  console.error('✗ dist/assets/content-<hash>.sqlite3 が存在しません（ビルドで生成・同梱されていない）')
  process.exit(1)
}
if (names.length > 1) {
  console.error(`✗ content-<hash>.sqlite3 が複数あります: ${names.join(', ')}`)
  process.exit(1)
}

const name = names[0]
const bytes = readFileSync(new URL(name, dir))
const MAGIC = Buffer.from('SQLite format 3\0', 'latin1')
if (bytes.length < 512 || !bytes.subarray(0, 16).equals(MAGIC)) {
  console.error(`✗ dist/assets/${name} が不正な SQLite です（${bytes.length} bytes）`)
  process.exit(1)
}
console.log(`✓ dist/assets/${name}: ${Math.round(bytes.length / 1024)} KB・SQLite ヘッダOK`)
