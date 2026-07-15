// 英英辞典(content/dict.ndjson)の各エントリに jaWords（ja の形態素分割）を付与する。
// 例文(sentences.ndjson)の jaWords と同じ規約：jaWords.join('') === ja（末尾句読点除く）。
// 分割は kuromoji（kuroshiro-analyzer-kuromoji の parse）で行い、surface_form を連結すると
// 元の ja に一致する（助詞・助動詞は独立トークン＝穴埋めに適した粒度）。
//
// 使い方:
//   node scripts/gen-dict-jawords.mjs           # 検証のみ（連結不一致の件数を報告、書き込まない）
//   node scripts/gen-dict-jawords.mjs --write    # content/dict.ndjson を更新し content-build で再生成
import { readNdjson, writeNdjson, runContentBuild } from './lib/ndjson.mjs'

const write = process.argv.includes('--write')
const url = new URL('../content/dict.ndjson', import.meta.url)
const TRAIL = /[。、？！]$/

const KuromojiAnalyzer = (await import('kuroshiro-analyzer-kuromoji')).default
const A = KuromojiAnalyzer.default ?? KuromojiAnalyzer
const az = new A()
await az.init()

const records = readNdjson(url)
let mismatch = 0
const mismatchSamples = []

for (const d of records) {
  const ja = d.ja || ''
  const body = ja.replace(TRAIL, '')
  const toks = await az.parse(body)
  const words = toks.map((t) => t.surface_form).filter((s) => s.length)
  if (words.join('') !== body) {
    // 連結不一致（想定外の正規化）→ 全体を1トークンにフォールバックし join を保証
    mismatch++
    if (mismatchSamples.length < 10) mismatchSamples.push({ word: d.word, ja: body, join: words.join('') })
    d.jaWords = [body]
  } else {
    d.jaWords = words
  }
}

console.log(`dict: ${records.length}件 / 連結フォールバック: ${mismatch}件`)
if (mismatchSamples.length) {
  console.log('不一致例:')
  for (const m of mismatchSamples) console.log(`  ${m.word}: ja="${m.ja}" join="${m.join}"`)
}

if (write) {
  writeNdjson(url, records)
  runContentBuild()
  console.log(`\n✓ content/dict.ndjson に jaWords を付与し生成物を再生成。続けて: npm run validate`)
} else {
  console.log('\n（検証のみ。--write で content/dict.ndjson を更新）')
}
