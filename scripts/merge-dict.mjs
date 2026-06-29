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
  if (d.theme != null && !THEMES.has(d.theme)) e.push('theme不正') // theme は任意（null 可）
  if (!d.ja) e.push('ja無し')
  if (TRAIL.test(d.ja || '')) e.push('和末尾記号') // 定義の訳は文末記号なし
  const r = toRomaji(d.kana || '')
  if (!d.kana) e.push('kana無し')
  else if (!ROMAJI_OK.test(r)) e.push('ローマ字')
  else if (kanaConsumed(d.kana, r) !== [...d.kana].length) e.push('未消費')
  return e
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
// out-NN.json と out-redo*.json の両方を読む（redo は再生成分）
const files = readdirSync(dir).filter((f) => /^out-[\w-]+\.json$/.test(f)).sort()
const raw = []
for (const f of files) raw.push(...readJson(`${dir}/${f}`))

// 重複除去：word キーの Map で後勝ち（読み順＝ファイル名順で後のもの＝out-redo* が元を上書き）。
// 既存英英(DICT)にある word は除外。
const existing = new Set(DICT.map((d) => d.word))
const byWord = new Map()
for (const d of raw) {
  if (!d.word || existing.has(d.word)) continue
  byWord.set(d.word, d) // 後勝ち（redo が元を上書き）
}
let all = [...byWord.values()]

// 読み点検の修正(revfix-*.json: [{word, kana}])を適用
const fixes = new Map()
for (const f of readdirSync(dir).filter((f) => /^revfix-\d+\.json$/.test(f))) {
  for (const x of readJson(`${dir}/${f}`)) fixes.set(x.word, x.kana)
}
for (const d of all) if (fixes.has(d.word)) d.kana = fixes.get(d.word)
if (fixes.size) console.log(`読み修正の適用: ${fixes.size}件（revfix-*.json）`)

// kana 自動生成（未指定の語のみ。ja から kuroshiro でひらがな化）。kana 既存は上書きしない。
let convert = null
try {
  const Kuroshiro = (await import('kuroshiro')).default
  const KuromojiAnalyzer = (await import('kuroshiro-analyzer-kuromoji')).default
  const K = Kuroshiro.default ?? Kuroshiro
  const A = KuromojiAnalyzer.default ?? KuromojiAnalyzer
  const ks = new K()
  await ks.init(new A())
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  convert = async (ja) => toHira(await ks.convert(ja, { to: 'hiragana' }))
} catch {
  console.warn('⚠ kuroshiro を読み込めませんでした。kana 列を手動で埋めてください。')
}
let autoKana = 0
for (const d of all) {
  if (!d.kana && d.ja && convert) {
    d.kana = await convert(d.ja)
    autoKana++
  }
}
if (autoKana) console.log(`読み自動生成: ${autoKana}件`)

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
  // theme は任意：null/未指定なら theme: null（クォート無し）、あれば従来通り
  const line = (d) => {
    const theme = d.theme == null ? 'null' : `'${esc(d.theme)}'`
    return `  { word: '${esc(d.word)}', def: '${esc(d.def)}', ja: '${esc(d.ja)}', kana: '${esc(d.kana)}', level: ${d.level}, theme: ${theme} },`
  }
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
