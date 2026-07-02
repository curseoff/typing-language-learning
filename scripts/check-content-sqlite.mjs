// 配信物 dist/content.sqlite3 のスモークチェック。
// ビルド後に「教材 DB が dist に載っていて、正しい SQLite ファイルである」ことを検証する。
// これで「デプロイに含まれず 404」「破損/途中切れ」を出荷前に検知する。
// 実行: node scripts/check-content-sqlite.mjs（npm run check:content）
import { readFileSync } from 'node:fs'

const path = new URL('../dist/content.sqlite3', import.meta.url)
let bytes
try {
  bytes = readFileSync(path)
} catch {
  console.error('✗ dist/content.sqlite3 が存在しません（ビルドで生成・同梱されていない）')
  process.exit(1)
}

const MAGIC = Buffer.from('SQLite format 3\0', 'latin1')
if (bytes.length < 512 || !bytes.subarray(0, 16).equals(MAGIC)) {
  console.error(`✗ dist/content.sqlite3 が不正な SQLite です（${bytes.length} bytes）`)
  process.exit(1)
}
console.log(`✓ dist/content.sqlite3: ${Math.round(bytes.length / 1024)} KB・SQLite ヘッダOK`)
