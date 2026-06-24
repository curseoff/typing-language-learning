// 単語例文の生成準備：まだ例文が無い頻出語を選び、生成用チャンクに分割する。
//
// 使い方:
//   node scripts/gen-sentences.mjs                       # 既定 1000語 / 12チャンク / /tmp/sentgen
//   node scripts/gen-sentences.mjs --count 800 --chunks 10 --dir /tmp/sentgen
//
// 出力: <dir>/chunk-01.json … （各 [{en,ja,level}]）。
// 次の手順: 各 chunk-*.json をサブエージェントに読ませ、例文JSONを <dir>/out-NN.json に書かせる。
//   要素: { word, level, en, ja, kana, jaWords }（規則は docs/CONTENT.md / merge-sentences.mjs と同じ）。

import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { WORDS } from '../src/content/words.js'
import { WORD_SENTENCES } from '../src/content/wordSentences.js'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const count = Number(arg('count', '1000'))
const chunks = Number(arg('chunks', '12'))
const dir = arg('dir', '/tmp/sentgen')

mkdirSync(dir, { recursive: true })
// 前回の生成物（chunk/out/rev など）を掃除して取り違えを防ぐ
for (const f of readdirSync(dir)) {
  if (/^(chunk|out|rev|revfix|redo|ok|bad)[-.]/.test(f)) rmSync(`${dir}/${f}`, { force: true })
}

const used = new Set(WORD_SENTENCES.map((s) => s.word))
const cand = WORDS.filter((w) => !used.has(w.en))
  .sort((a, b) => (a.freq ?? 0) - (b.freq ?? 0))
  .slice(0, count)
  .map((w) => ({ en: w.en, ja: w.ja, level: w.level }))

const size = Math.ceil(cand.length / chunks)
let files = 0
for (let i = 0; i < chunks; i++) {
  const part = cand.slice(i * size, (i + 1) * size)
  if (!part.length) break
  writeFileSync(`${dir}/chunk-${String(i + 1).padStart(2, '0')}.json`, JSON.stringify(part))
  files++
}

const dist = cand.reduce((a, w) => ((a[`L${w.level}`] = (a[`L${w.level}`] || 0) + 1), a), {})
console.log(`既存例文: ${used.size}語 / 新規選定: ${cand.length}語 / ${files}チャンク（各~${size}語）`)
console.log(`レベル分布: ${JSON.stringify(dist)}`)
console.log(`出力先: ${dir}/chunk-01.json … chunk-${String(files).padStart(2, '0')}.json`)
console.log(`次: 各 chunk-*.json をエージェントに読ませ ${dir}/out-NN.json を生成 → npm run merge-sentences`)
