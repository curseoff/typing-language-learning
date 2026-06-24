// 英英辞典の生成パイプライン①：未作成の頻出語を選び、エージェント生成用にチャンク分割する。
// 英英は単語のサブセット（word∈words・level/theme一致）。頻出（L1〜L3）から優先。
//   node scripts/gen-dict.mjs --count 2000 --chunks 20 [--levels 1,2,3]
// → /tmp/dictgen/chunk-NN.json（{word, ja, level, theme} の配列）を出力。
//   各チャンクをエージェントに読ませ out-NN.json（{word, def, ja, kana, level, theme}）を作らせる。
import { writeFileSync, mkdirSync } from 'node:fs'
import { WORDS } from '../src/content/wordsAll.js'
import { DICT } from '../src/content/dictionaryAll.js'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const count = Number(arg('count', 2000))
const chunks = Number(arg('chunks', 20))
const levels = new Set(
  arg('levels', '1,2,3')
    .split(',')
    .map((n) => Number(n)),
)
const dir = arg('dir', '/tmp/dictgen')
mkdirSync(dir, { recursive: true })

const have = new Set(DICT.map((d) => d.word))
const EN_OK = /^[a-z]+$/
// 候補：未作成・英小文字のみ・対象レベル・freq あり。頻出（freq小）優先。
const cands = WORDS.filter(
  (w) => !have.has(w.en) && EN_OK.test(w.en) && levels.has(w.level) && typeof w.freq === 'number',
)
  .sort((a, b) => a.freq - b.freq)
  .slice(0, count)
  .map((w) => ({ word: w.en, ja: w.ja, level: w.level, theme: w.theme ?? null }))

const per = Math.ceil(cands.length / chunks)
for (let i = 0; i < chunks; i++) {
  const part = cands.slice(i * per, (i + 1) * per)
  if (part.length === 0) break
  const nn = String(i + 1).padStart(2, '0')
  writeFileSync(`${dir}/chunk-${nn}.json`, JSON.stringify(part))
}
const byLv = {}
cands.forEach((c) => (byLv[c.level] = (byLv[c.level] || 0) + 1))
console.log(`選定: ${cands.length}語（${chunks}分割・各~${per}語）→ ${dir}/chunk-NN.json`)
console.log(`レベル分布: ${JSON.stringify(byLv)}`)
console.log(`既存英英: ${DICT.length}語 / 生成後想定: ${DICT.length + cands.length}語`)
