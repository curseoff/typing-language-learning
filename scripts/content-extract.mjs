// 一度きりの移行ツール：既存の src/content/wordsData.js（配列）から
// content/words.ndjson（1行1レコードの NDJSON＝正準ソース）を生成する。
// 全フィールドを無損失で保存し（freq 等も落とさない）、書き出し前に原本と等価検証する。
// 実行: node scripts/content-extract.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const srcUrl = new URL('../src/content/wordsData.js', import.meta.url)
const { default: WORDS } = await import(srcUrl)

// キー出力順（可読性・安定 diff のため）。未知キーは末尾にアルファベット順で付ける。
const ORDER = ['en', 'word', 'def', 'ja', 'kana', 'freq', 'level', 'theme', 'jaWords']
function canon(o) {
  const keys = Object.keys(o)
  const ordered = [
    ...ORDER.filter((k) => k in o),
    ...keys.filter((k) => !ORDER.includes(k)).sort(),
  ]
  const r = {}
  for (const k of ordered) r[k] = o[k]
  return r
}

function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (a && b && typeof a === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

const lines = WORDS.map((w) => JSON.stringify(canon(w)))

// 等価検証：NDJSON へ落として読み直したものが原本と一致するか（無損失の担保）。
let mismatch = 0
WORDS.forEach((w, i) => {
  if (!deepEqual(w, JSON.parse(lines[i]))) mismatch++
})
if (mismatch) {
  console.error(`✗ 等価検証 NG: ${mismatch} / ${WORDS.length} 件が不一致`)
  process.exit(1)
}

mkdirSync(new URL('../content/', import.meta.url), { recursive: true })
writeFileSync(new URL('../content/words.ndjson', import.meta.url), lines.join('\n') + '\n')
console.log(`content:extract words → ${lines.length} 件（等価 OK）`)
