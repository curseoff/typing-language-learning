// 単語例文のテーマ絞り込みメタ（theme.js / wsentCounts.js）を生成する。
//
// 単語例文データ（L*.js）には theme が無い（巨大な生成物を書き換えない方針）。
// 代わりに「見出し語 word → theme」を単語データ（WORDS）から引いてレベル別に出力する。
// 計算・描画は scripts/lib/wsentMeta.mjs を content-build と共有する。
//
// 出力（いずれも生成物＝gitignore）:
//   src/content/wordSentences/theme.js        … word→theme マップ（テーマ付き語のみ）
//   src/content/wordSentences/wsentCounts.js  … WSENT_COUNTS（level×theme 件数。index.js が re-export）
//
// 使い方: node scripts/gen-wsent-theme.mjs（npm run gen-wsent-theme）
import { writeFileSync } from 'node:fs'
import { WORDS } from '../src/content/wordsAll.js'
import { WORD_SENTENCES } from '../src/content/wordSentences/all.js'
import { WORD_THEMES } from '../src/content/words.js'
import { computeWsentMeta, renderThemeJs, renderWsentCountsJs } from './lib/wsentMeta.mjs'

const { themeMap, counts } = computeWsentMeta(WORD_SENTENCES, WORDS, WORD_THEMES)
const dirUrl = (p) => new URL(`../src/content/wordSentences/${p}`, import.meta.url)
writeFileSync(dirUrl('theme.js'), renderThemeJs(themeMap))
writeFileSync(dirUrl('wsentCounts.js'), renderWsentCountsJs(counts))

const total = Object.values(themeMap).reduce((n, m) => n + Object.keys(m).length, 0)
console.log(`✓ theme.js（テーマ付き ${total} 語）と wsentCounts.js を生成`)
console.log(JSON.stringify(counts))
