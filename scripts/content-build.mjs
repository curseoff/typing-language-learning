// 生成ツール：content/*.ndjson・content/stories/*.json（正準ソース）から
// アプリが import する src/content/*.js（データ本体）を生成する。
// これらの生成物は gitignore 対象（prebuild/predev/prevalidate/pretest/precoverage で自動生成）。
// 実行: node scripts/content-build.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { WORD_THEMES } from '../src/content/words.js'
import { computeWsentMeta, renderThemeJs, renderWsentCountsJs } from './lib/wsentMeta.mjs'

const u = (p) => new URL(p, import.meta.url)
const GEN = '// 自動生成（scripts/content-build.mjs）。編集しない。'

// NDJSON を読み、各行を JSON 検証して配列で返す。
function readNdjson(rel) {
  const src = readFileSync(u('../' + rel), 'utf8')
  const lines = src.split('\n').filter((l) => l.trim())
  lines.forEach((l, i) => {
    try {
      JSON.parse(l)
    } catch {
      console.error(`✗ ${rel}: 行 ${i + 1} が不正な JSON`)
      process.exit(1)
    }
  })
  return lines
}

// 配列モジュール（words/dict）：NDJSON 各行をそのまま配列要素に並べる。
function buildArray(ndjsonRel, outRel, sourceNote) {
  const lines = readNdjson(ndjsonRel)
  const out = `${GEN} ソース: ${sourceNote}\nexport default [\n${lines.join(',\n')}\n]\n`
  writeFileSync(u('../' + outRel), out)
  console.log(`build → ${outRel}: ${lines.length} 件`)
}

// ---- words / dict ----
buildArray('content/words.ndjson', 'src/content/wordsData.js', 'content/words.ndjson')
buildArray('content/dict.ndjson', 'src/content/dictionaryData.js', 'content/dict.ndjson')

// ---- gloss（en→ja マップ）----
{
  const lines = readNdjson('content/gloss.ndjson')
  const pairs = lines.map((l) => {
    const { en, ja } = JSON.parse(l)
    return `${JSON.stringify(en)}:${JSON.stringify(ja)}`
  })
  const out = `${GEN} ソース: content/gloss.ndjson\nexport default {${pairs.join(',')}}\n`
  writeFileSync(u('../src/content/wordGlossData.js'), out)
  console.log(`build → src/content/wordGlossData.js: ${pairs.length} 件`)
}

// ---- sentences（例文）: level ごとに L1..L4.js へ分割＋theme.js/wsentCounts.js 派生生成 ----
{
  const lines = readNdjson('content/sentences.ndjson')
  const sentences = lines.map((l) => JSON.parse(l))
  const byLevel = new Map() // level -> string[]（NDJSON 行を順序維持で保持）
  for (const l of lines) {
    const lv = JSON.parse(l).level
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv).push(l)
  }
  for (const lv of [...byLevel.keys()].sort((a, b) => a - b)) {
    const arr = byLevel.get(lv)
    const out = `${GEN} ソース: content/sentences.ndjson（L${lv}）\nexport default [\n${arr.join(',\n')}\n]\n`
    writeFileSync(u(`../src/content/wordSentences/L${lv}.js`), out)
    console.log(`build → src/content/wordSentences/L${lv}.js: ${arr.length} 件`)
  }
  // theme.js / wsentCounts.js は例文＋単語テーマからの派生物（word→theme は words.ndjson から引く）
  const words = readNdjson('content/words.ndjson').map((l) => JSON.parse(l))
  const { themeMap, counts } = computeWsentMeta(sentences, words, WORD_THEMES)
  writeFileSync(u('../src/content/wordSentences/theme.js'), renderThemeJs(themeMap))
  writeFileSync(u('../src/content/wordSentences/wsentCounts.js'), renderWsentCountsJs(counts))
  console.log('build → src/content/wordSentences/{theme,wsentCounts}.js')
}

// ---- stories（ネスト文書）: content/stories/*.json → 名前付き export の .js ----
{
  const dir = u('../content/stories/')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const id = f.replace(/\.json$/, '')
    const obj = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    const out = `${GEN} ソース: content/stories/${f}\nexport const ${id} = ${JSON.stringify(obj, null, 2)}\n`
    writeFileSync(u(`../src/content/stories/${id}.js`), out)
    console.log(`build → src/content/stories/${id}.js`)
  }
}
