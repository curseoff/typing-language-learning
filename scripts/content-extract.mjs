// 一度きりの移行ツール：既存の src/content/*.js（データ本体）から
// content/*.ndjson（および物語は content/stories/*.json）＝正準ソースを生成する。
// 全フィールドを無損失で保存し、書き出し前に原本と等価検証する。
// 実行: node scripts/content-extract.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

// キー出力順（可読性・安定 diff）。未知キーは末尾にアルファベット順。
const ORDER = ['en', 'word', 'def', 'ja', 'kana', 'freq', 'level', 'theme', 'jaWords']
function canon(o) {
  const keys = Object.keys(o)
  const ordered = [...ORDER.filter((k) => k in o), ...keys.filter((k) => !ORDER.includes(k)).sort()]
  const r = {}
  for (const k of ordered) r[k] = o[k]
  return r
}
function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (a && b && typeof a === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}
const u = (p) => new URL(p, import.meta.url)
const write = (rel, text) => writeFileSync(u('../' + rel), text)

// 配列データ（words/dict/sentences）を NDJSON 化し、原本と無損失一致を検証。
function extractArray(records, outRel) {
  const lines = records.map((r) => JSON.stringify(canon(r)))
  let bad = 0
  records.forEach((r, i) => {
    if (!deepEqual(r, JSON.parse(lines[i]))) bad++
  })
  if (bad) {
    console.error(`✗ ${outRel}: 等価検証 NG ${bad}/${records.length} 件`)
    process.exit(1)
  }
  write(outRel, lines.join('\n') + '\n')
  console.log(`extract → ${outRel}: ${lines.length} 件（等価 OK）`)
}

// ---- words ----
{
  const { default: WORDS } = await import(u('../src/content/wordsData.js'))
  extractArray(WORDS, 'content/words.ndjson')
}
// ---- dict（英英）----
{
  const { default: DICT } = await import(u('../src/content/dictionaryData.js'))
  extractArray(DICT, 'content/dict.ndjson')
}
// ---- sentences（例文・全レベル連結）----
{
  const { WORD_SENTENCES } = await import(u('../src/content/wordSentences/all.js'))
  extractArray(WORD_SENTENCES, 'content/sentences.ndjson')
}
// ---- gloss（en→ja マップ）→ {en,ja} の NDJSON ----
{
  const { default: MAP } = await import(u('../src/content/wordGlossData.js'))
  const entries = Object.entries(MAP)
  const lines = entries.map(([en, ja]) => JSON.stringify({ en, ja }))
  // 逆組みして原本マップと一致するか
  const back = {}
  for (const l of lines) {
    const { en, ja } = JSON.parse(l)
    back[en] = ja
  }
  if (!deepEqual(MAP, back)) {
    console.error('✗ content/gloss.ndjson: 等価検証 NG')
    process.exit(1)
  }
  write('content/gloss.ndjson', lines.join('\n') + '\n')
  console.log(`extract → content/gloss.ndjson: ${lines.length} 件（等価 OK）`)
}
// ---- stories（ネスト文書）→ 1物語=1 JSON ----
{
  mkdirSync(u('../content/stories/'), { recursive: true })
  const mod = await import(u('../src/content/stories/index.js'))
  for (const story of mod.STORIES) {
    const json = JSON.stringify(story, null, 2)
    if (!deepEqual(story, JSON.parse(json))) {
      console.error(`✗ content/stories/${story.id}.json: 等価検証 NG`)
      process.exit(1)
    }
    write(`content/stories/${story.id}.json`, json + '\n')
    console.log(`extract → content/stories/${story.id}.json（等価 OK）`)
  }
}
