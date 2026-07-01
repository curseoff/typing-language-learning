// 生成ツール：content/words.ndjson（正準ソース）から
// src/content/wordsData.js（アプリが遅延 import する配列モジュール）を生成する。
// NDJSON は各行が JSON なので、そのまま配列要素として並べれば等価な JS になる。
// この生成物は gitignore 対象（prebuild/predev/prevalidate で自動生成）。
// 実行: node scripts/content-build.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const ndUrl = new URL('../content/words.ndjson', import.meta.url)
const src = readFileSync(ndUrl, 'utf8')
const lines = src.split('\n').filter((l) => l.trim())

// 健全性：各行が正しい JSON であることを確認（壊れた行で不正な JS を吐かない）。
lines.forEach((l, i) => {
  try {
    JSON.parse(l)
  } catch {
    console.error(`✗ content/words.ndjson: 行 ${i + 1} が不正な JSON です`)
    process.exit(1)
  }
})

const header = '// 自動生成（scripts/content-build.mjs）。編集しない。ソース: content/words.ndjson\n'
const out = `${header}export default [\n${lines.join(',\n')}\n]\n`
writeFileSync(new URL('../src/content/wordsData.js', import.meta.url), out)
console.log(`content:build words → ${lines.length} 件`)
