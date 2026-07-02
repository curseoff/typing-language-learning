// 単語の英→和グロッサリの正準ソース content/gloss.ndjson を生成する。
//   node scripts/gen-gloss.mjs
// wordsAll.js の WORDS から { en, ja } を作り NDJSON で書き出す（遅延 import 用の
// wordGlossData.js は content-build が生成する）。重複 en は最後の ja で上書き。
import { WORDS } from '../src/content/wordsAll.js'
import { WORD_SENTENCES } from '../src/content/wordSentences/all.js'
import { writeNdjson, runContentBuild } from './lib/ndjson.mjs'

// en → ja（重複は最後の ja で上書き）
const gloss = {}
for (const w of WORDS) {
  if (w?.en && w?.ja) gloss[w.en] = w.ja
}

const entries = Object.entries(gloss).map(([en, ja]) => ({ en, ja }))
writeNdjson(new URL('../content/gloss.ndjson', import.meta.url), entries)
runContentBuild()
console.log(`✓ content/gloss.ndjson を再生成し wordGlossData.js を更新（${entries.length}件）`)

// 単語例文で使う全 word にグロッサリがあるか簡易チェック（欠けは件数報告）。
const used = new Set(WORD_SENTENCES.map((s) => s.word).filter(Boolean))
const missing = [...used].filter((en) => !(en in gloss))
console.log(`gloss entries: ${Object.keys(gloss).length}`)
console.log(`wsent words: ${used.size}, missing gloss: ${missing.length}`)
if (missing.length) console.log('missing(先頭20):', missing.slice(0, 20).join(', '))
