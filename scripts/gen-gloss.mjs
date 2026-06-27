// 単語の英→和グロッサリを生成する（src/content/wordGlossData.js）。
//   node scripts/gen-gloss.mjs
// wordsAll.js の WORDS から { [en]: ja } の軽量辞書を作り、遅延 import 用に書き出す。
// プレイ画面の「単語 word（和訳）」併記に使う（1.6M の単語データ全体を読まずに済む）。
// 重複 en は最後の ja で上書き。生成物は遅延チャンクなので初回バンドルには含めない。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { WORDS } from '../src/content/wordsAll.js'
import { WORD_SENTENCES } from '../src/content/wordSentences/all.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../src/content/wordGlossData.js')

// en → ja（重複は最後の ja で上書き）
const gloss = {}
for (const w of WORDS) {
  if (w?.en && w?.ja) gloss[w.en] = w.ja
}

const header =
  '// 自動生成（scripts/gen-gloss.mjs）。編集しない。\n' +
  '// 単語の英→和グロッサリ（プレイ画面の「単語 word（和訳）」併記用）。\n' +
  '// 遅延 import 専用（words.js の loadWordGloss）。初回バンドルには含めない。\n'

writeFileSync(OUT, header + 'export default ' + JSON.stringify(gloss) + '\n')

// 単語例文で使う全 word にグロッサリがあるか簡易チェック（欠けは件数報告）。
const used = new Set(WORD_SENTENCES.map((s) => s.word).filter(Boolean))
const missing = [...used].filter((en) => !(en in gloss))
console.log(`gloss entries: ${Object.keys(gloss).length}`)
console.log(`wsent words: ${used.size}, missing gloss: ${missing.length}`)
if (missing.length) console.log('missing(先頭20):', missing.slice(0, 20).join(', '))
