// 単語例文のテーマ絞り込み用メタを生成する。
//
// 単語例文データ（L*.js）自体には theme フィールドが無い（巨大な生成物を書き換えない方針）。
// 代わりに「見出し語 word → theme」の軽量マップを単語データ（wordsAll.js の WORDS）から引いて
// レベル別に出力し、読み込み時にフィルタできるようにする。
//
// 出力:
//   src/content/wordSentences/theme.js  … export default { 1: { word: theme, ... }, 2: {...}, ... }（テーマ付き語のみ）
//   src/content/wordSentences/index.js の WSENT_COUNTS を level×theme 形式へ更新
//
// 使い方: node scripts/gen-wsent-theme.mjs（npm run gen-wsent-theme）

import { readFileSync, writeFileSync } from 'node:fs'
import { WORDS } from '../src/content/wordsAll.js'
import { WORD_SENTENCES } from '../src/content/wordSentences/all.js'
import { WORD_THEMES } from '../src/content/words.js'

const LEVELS = [1, 2, 3, 4]

// 見出し語 → theme（テーマ付きの語のみ）
const themeOf = new Map(WORDS.filter((w) => w.theme).map((w) => [w.en, w.theme]))

// レベル別の word→theme マップと、level×theme の件数を組み立てる
const themeMap = {} // { [level]: { [word]: theme } }
const counts = {} // { [level]: { すべて: n, 日常: n, ... } }
for (const lv of LEVELS) {
  themeMap[lv] = {}
  counts[lv] = { すべて: 0, ...Object.fromEntries(WORD_THEMES.map((t) => [t, 0])) }
}

for (const s of WORD_SENTENCES) {
  const c = counts[s.level]
  if (!c) continue
  c.すべて++
  const t = themeOf.get(s.word)
  if (t && c[t] != null) {
    c[t]++
    themeMap[s.level][s.word] = t
  }
}

// theme.js を出力（遅延 import 専用＝初回バンドルに載せない）
const dirUrl = (p) => new URL(`../src/content/wordSentences/${p}`, import.meta.url)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const mapBody = LEVELS.map((lv) => {
  const entries = Object.entries(themeMap[lv]).sort(([a], [b]) => a.localeCompare(b))
  const inner = entries.map(([w, t]) => `'${esc(w)}': '${esc(t)}'`).join(', ')
  return `  ${lv}: { ${inner} },`
}).join('\n')
writeFileSync(
  dirUrl('theme.js'),
  '// 単語例文のテーマ絞り込み用マップ（見出し語 word → theme）。生成は scripts/gen-wsent-theme。\n' +
    '// 遅延 import 専用（初回バンドルに含めない）。テーマ付きの語のみを収録する。\n' +
    `export default {\n${mapBody}\n}\n`,
)

// index.js の WSENT_COUNTS を level×theme 形式へ書き換える（loaders 等はそのまま）
const idxPath = dirUrl('index.js')
const idxSrc = readFileSync(idxPath, 'utf8')
const next = idxSrc.replace(
  /export const WSENT_COUNTS = .*\n/,
  `export const WSENT_COUNTS = ${JSON.stringify(counts)}\n`,
)
// テーママップのローダ宣言が無ければ追加する
let next2 = next
if (!next2.includes('loadWsentThemes')) {
  next2 = next2.replace(
    /(export const loadWsentLevel = .*\n)/,
    `$1export const loadWsentThemes = () => import('./theme.js').then((m) => m.default)\n`,
  )
}
writeFileSync(idxPath, next2)

const total = LEVELS.reduce((n, lv) => n + Object.keys(themeMap[lv]).length, 0)
console.log(`✓ theme.js（テーマ付き ${total} 語）と index.js の WSENT_COUNTS を更新`)
console.log(JSON.stringify(counts))
