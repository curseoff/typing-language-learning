// 単語例文の読み点検（候補抽出）。ok.json の kana を kuroshiro が生成する読みと突き合わせ、
// 不一致を rev-*.json に分割出力する（誤検出を多く含むので、最終判断は点検エージェントが行う）。
//
// 使い方:
//   node scripts/check-readings.mjs                 # /tmp/sentgen/ok.json → rev-1..4.json
//   node scripts/check-readings.mjs --chunks 4 --dir /tmp/sentgen
//
// 次: 各 rev-N.json を点検エージェントに渡し、真の誤りだけ revfix-N.json に出させる → merge-sentences --write

import { readFileSync, writeFileSync } from 'node:fs'
import Kuroshiro from 'kuroshiro'
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const dir = arg('dir', '/tmp/sentgen')
const chunks = Number(arg('chunks', '4'))

const K = Kuroshiro.default ?? Kuroshiro
const A = KuromojiAnalyzer.default ?? KuromojiAnalyzer
const ks = new K()
await ks.init(new A())
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

const ok = JSON.parse(readFileSync(`${dir}/ok.json`, 'utf8'))
const cand = []
for (const s of ok) {
  const body = s.ja.replace(/[。、？！]$/, '')
  let gen
  try {
    gen = toHira(await ks.convert(body, { to: 'hiragana' }))
  } catch {
    continue
  }
  const kana = s.kana.replace(/[。、？！]$/, '')
  if (gen !== kana) cand.push({ word: s.word, ja: s.ja, kana, gen })
}

const size = Math.ceil(cand.length / chunks)
let files = 0
for (let i = 0; i < chunks; i++) {
  const part = cand.slice(i * size, (i + 1) * size)
  if (!part.length) break
  writeFileSync(`${dir}/rev-${i + 1}.json`, JSON.stringify(part))
  files++
}
console.log(`読み不一致候補: ${cand.length} / ${ok.length}（誤検出を含む） → ${files}個の rev-*.json`)
if (cand.length) console.log(`次: 各 rev-N.json を点検エージェントへ → revfix-N.json → npm run merge-sentences -- --write`)
process.exit(0)
