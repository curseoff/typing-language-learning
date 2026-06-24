// 英英辞典の生成パイプライン②：out-*.json を検証し、英英データへマージする。
//   node scripts/merge-dict.mjs            # 検証のみ → ok.json / bad.json
//   node scripts/merge-dict.mjs --write    # dictionaryData.js の DICT を再生成（既存＋新規）
//                                          # 併せて dictionary.js の DICT_COUNTS/AVAILABLE_LEVELS も更新
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { WORDS } from '../src/content/wordsAll.js'
import { DICT } from '../src/content/dictionaryAll.js'
import { WORD_LEVELS, WORD_THEMES } from '../src/content/words.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const dir = arg('dir', '/tmp/dictgen')
const write = process.argv.includes('--write')

const wordByEn = new Map(WORDS.map((w) => [w.en, w]))
const THEMES = new Set(WORD_THEMES)
const EN_OK = /^[a-z]+$/
const DEF_OK = /^[a-z ]+$/
const ROMAJI_OK = /^[a-z'.,?!-]+$/
const TRAIL = /[。、？！]$/

function validate(d) {
  const e = []
  if (!d.word || !EN_OK.test(d.word)) e.push('word不正')
  const w = wordByEn.get(d.word)
  if (!w) e.push('word不在')
  else {
    if (w.level !== d.level) e.push('level不一致')
    if (w.theme !== undefined && w.theme !== d.theme) e.push('theme不一致')
  }
  if (!d.def || !DEF_OK.test(d.def)) e.push('def書式')
  if (!THEMES.has(d.theme)) e.push('theme不正')
  if (!d.ja) e.push('ja無し')
  if (TRAIL.test(d.ja || '')) e.push('和末尾記号') // 定義の訳は文末記号なし
  const r = toRomaji(d.kana || '')
  if (!d.kana) e.push('kana無し')
  else if (!ROMAJI_OK.test(r)) e.push('ローマ字')
  else if (kanaConsumed(d.kana, r) !== [...d.kana].length) e.push('未消費')
  return e
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const files = readdirSync(dir).filter((f) => /^out-\d\d\.json$/.test(f)).sort()
let all = []
for (const f of files) all.push(...readJson(`${dir}/${f}`))

// 読み点検の修正(revfix-*.json: [{word, kana}])を適用
const fixes = new Map()
for (const f of readdirSync(dir).filter((f) => /^revfix-\d+\.json$/.test(f))) {
  for (const x of readJson(`${dir}/${f}`)) fixes.set(x.word, x.kana)
}
for (const d of all) if (fixes.has(d.word)) d.kana = fixes.get(d.word)
if (fixes.size) console.log(`読み修正の適用: ${fixes.size}件（revfix-*.json）`)

// 既存英英・入力内の重複 word を除去
const existing = new Set(DICT.map((d) => d.word))
const seen = new Set()
all = all.filter((d) => {
  if (!d.word || seen.has(d.word) || existing.has(d.word)) return false
  seen.add(d.word)
  return true
})

const ok = []
const bad = []
for (const d of all) {
  const e = validate(d)
  if (e.length) bad.push({ word: d.word, errs: e })
  else ok.push({ word: d.word, def: d.def, ja: d.ja, kana: d.kana, level: d.level, theme: d.theme })
}
writeFileSync(`${dir}/ok.json`, JSON.stringify(ok))
writeFileSync(`${dir}/bad.json`, JSON.stringify(bad))

const tally = {}
for (const b of bad) for (const e of b.errs) tally[e] = (tally[e] || 0) + 1
console.log(`入力: ${all.length} / OK: ${ok.length} / NG: ${bad.length}  ${JSON.stringify(tally)}`)
if (bad.length) console.log(`NG例:`, bad.slice(0, 8).map((b) => `${b.word}[${b.errs}]`).join(' '))

if (write) {
  if (bad.length) {
    console.error(`\n✖ NG が ${bad.length} 件。先に解消してから --write してください。`)
    process.exit(1)
  }
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const line = (d) =>
    `  { word: '${esc(d.word)}', def: '${esc(d.def)}', ja: '${esc(d.ja)}', kana: '${esc(d.kana)}', level: ${d.level}, theme: '${esc(d.theme)}' },`
  const merged = [...DICT, ...ok]
  const uniq = new Map(merged.map((d) => [d.word, d]))
  const list = [...uniq.values()]
  // dictionaryData.js の DICT 配列だけ再生成（ヘッダ/default export は保持）
  const dataPath = new URL('../src/content/dictionaryData.js', import.meta.url)
  const dataSrc = readFileSync(dataPath, 'utf8')
  const head = dataSrc.slice(0, dataSrc.indexOf('export default ['))
  let body = ''
  for (const l of WORD_LEVELS) {
    const part = list.filter((d) => d.level === l.level).sort((a, b) => a.word.localeCompare(b.word))
    if (!part.length) continue
    body += `  // ---- L${l.level} ${l.label} ----\n${part.map(line).join('\n')}\n`
  }
  writeFileSync(dataPath, `${head}export default [\n${body}]\n`)

  // dictionary.js の静的メタ（DICT_COUNTS/DICT_AVAILABLE_LEVELS）を再計算して埋め込む。
  const counts = {}
  for (const l of WORD_LEVELS) {
    const c = { すべて: list.filter((d) => d.level === l.level).length }
    for (const t of WORD_THEMES) c[t] = list.filter((d) => d.level === l.level && d.theme === t).length
    counts[l.level] = c
  }
  const levels = [...new Set(list.map((d) => d.level))].sort((a, b) => a - b)
  const metaPath = new URL('../src/content/dictionary.js', import.meta.url)
  let metaSrc = readFileSync(metaPath, 'utf8')
  metaSrc = metaSrc.replace(
    /export const DICT_COUNTS = .*\n/,
    `export const DICT_COUNTS = ${JSON.stringify(counts)}\n`,
  )
  metaSrc = metaSrc.replace(
    /export const DICT_AVAILABLE_LEVELS = .*\n/,
    `export const DICT_AVAILABLE_LEVELS = ${JSON.stringify(levels)}\n`,
  )
  writeFileSync(metaPath, metaSrc)
  console.log(`\n✓ dictionaryData.js を再生成（合計 ${list.length}語）。dictionary.js のメタも更新。続けて: npm run check`)
}
