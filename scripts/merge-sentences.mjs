// 単語例文のマージ・構造検証。out-*.json（あれば out-redo.json を優先）を検証し、
// OK/NG を仕分けて ok.json / bad.json / redo.json を書く。--write で読み修正(revfix-*.json)を
// 適用し、WORD_SENTENCES（src/content/wordSentences/L1..L4.js）へ追記・再生成する。
//
// 使い方:
//   node scripts/merge-sentences.mjs               # 検証のみ → ok.json / bad.json / redo.json
//   node scripts/merge-sentences.mjs --write       # revfix を適用し wordSentences.js に追記
//   node scripts/merge-sentences.mjs --dir /tmp/sentgen
//
// パイプライン:
//   gen-sentences → (agentで out-NN.json) → merge-sentences → (NGがあればagentで out-redo.json)
//   → merge-sentences → check-readings → (agentで revfix-NN.json) → merge-sentences --write

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { WORDS } from '../src/content/wordsAll.js'
import { WORD_SENTENCES } from '../src/content/wordSentences/all.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const dir = arg('dir', '/tmp/sentgen')
const write = process.argv.includes('--write')

const wEn = new Set(WORDS.map((w) => w.en))
const wByEn = new Map(WORDS.map((w) => [w.en, w]))
const ROMAJI_OK = /^[a-z'.,?!-]+$/
const TRAIL = /[。、？！]$/
const PUNCT = { '.': '。', '?': '？', '!': '！' }

const bases = (t) => {
  const f = [t]
  if (t.endsWith('ies')) f.push(t.slice(0, -3) + 'y')
  if (t.endsWith('es')) f.push(t.slice(0, -2))
  if (t.endsWith('s')) f.push(t.slice(0, -1))
  if (t.endsWith('ed')) f.push(t.slice(0, -2), t.slice(0, -1))
  if (t.endsWith('ing')) f.push(t.slice(0, -3), t.slice(0, -3) + 'e')
  // 子音重ね（tipped→tip, running→run）: 末尾2文字が同じ子音なら1つ落とす
  const dbl = t.match(/^([a-z]+?)([bcdfghjklmnpqrstvwxz])\2(?:ed|ing)$/)
  if (dbl) f.push(dbl[1] + dbl[2])
  return f
}
const uses = (en, w) => {
  const lc = (en || '').toLowerCase()
  const tk = lc.match(/[a-z]+/g) || []
  if (tk.some((t) => t === w || bases(t).includes(w))) return true
  // 融合語（deliverup=「deliver up」）: 単語境界を除いた連結でも照合する
  return lc.replace(/[^a-z]+/g, '').includes(w)
}
function validate(s) {
  const e = []
  if (!s.word || !wEn.has(s.word)) e.push('word不在')
  else {
    if (!uses(s.en, s.word)) e.push('語なし')
    if (wByEn.get(s.word).level !== s.level) e.push('level')
  }
  const m = s.en?.slice(-1)
  if (PUNCT[m]) {
    if (!s.ja?.endsWith(PUNCT[m])) e.push('和末尾')
    if (!s.kana?.endsWith(PUNCT[m])) e.push('kana末尾')
  } else e.push('en末尾')
  if (s.kana?.includes('ー')) e.push('ー')
  const r = toRomaji(s.kana || '')
  if (!ROMAJI_OK.test(r)) e.push('ローマ字')
  else if (kanaConsumed(s.kana, r) !== [...s.kana].length) e.push('未消費')
  if ((s.jaWords || []).join('') !== (s.ja || '').replace(TRAIL, '')) e.push('jaWords')
  return e
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const files = (re) => readdirSync(dir).filter((f) => re.test(f)).sort()

// out-*.json を集約（out-redo.json があれば word 単位で上書き）
let all = []
for (const f of files(/^out-\d\d\.json$/)) all.push(...readJson(`${dir}/${f}`))
if (existsSync(`${dir}/out-redo.json`)) {
  const rm = new Map(readJson(`${dir}/out-redo.json`).map((s) => [s.word, s]))
  all = all.map((s) => rm.get(s.word) || s)
}

// 読み修正(revfix-*.json)を適用（--write 時のみ反映するが、ここで適用して検証も通す）
const fixes = new Map()
for (const f of files(/^revfix-\d+\.json$/)) for (const x of readJson(`${dir}/${f}`)) fixes.set(x.word, x.kana)
for (const s of all) {
  if (fixes.has(s.word)) {
    const end = s.kana?.match(TRAIL)?.[0] || ''
    s.kana = fixes.get(s.word).replace(TRAIL, '') + end
  }
}

// 既存 WORD_SENTENCES と入力内の重複 word を除去
const existing = new Set(WORD_SENTENCES.map((s) => s.word))
const seen = new Set()
all = all.filter((s) => {
  if (!s.word || seen.has(s.word) || existing.has(s.word)) return false
  seen.add(s.word)
  return true
})

const ok = []
const bad = []
for (const s of all) {
  const e = validate(s)
  if (e.length) bad.push({ word: s.word, errs: e })
  else ok.push({ level: s.level, word: s.word, en: s.en, ja: s.ja, kana: s.kana, jaWords: s.jaWords })
}
writeFileSync(`${dir}/ok.json`, JSON.stringify(ok))
writeFileSync(`${dir}/bad.json`, JSON.stringify(bad.map((b) => b.word)))

// NG語の生成元(en/ja/level)を chunk から集めて redo.json に（再生成エージェント用）
const badSet = new Set(bad.map((b) => b.word))
const src = []
for (const f of files(/^chunk-\d\d\.json$/)) src.push(...readJson(`${dir}/${f}`))
writeFileSync(`${dir}/redo.json`, JSON.stringify(src.filter((w) => badSet.has(w.en))))

const tally = {}
for (const b of bad) for (const e of b.errs) tally[e] = (tally[e] || 0) + 1
console.log(`入力: ${all.length} / 構造OK: ${ok.length} / NG: ${bad.length}  ${JSON.stringify(tally)}`)
if (fixes.size) console.log(`読み修正の適用: ${fixes.size}件（revfix-*.json）`)
if (bad.length) console.log(`NG語 → ${dir}/redo.json（agentで作り直し → out-redo.json → 再度 merge）`)

if (write) {
  if (bad.length) {
    console.error(`\n✖ NG が ${bad.length} 件残っています。先に解消してから --write してください。`)
    process.exit(1)
  }
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const line = (s) =>
    `  { level: ${s.level}, word: '${esc(s.word)}', en: '${esc(s.en)}', ja: '${esc(s.ja)}', kana: '${esc(s.kana)}', jaWords: [${s.jaWords.map((w) => `'${esc(w)}'`).join(', ')}] },`
  const merged = [...WORD_SENTENCES, ...ok]
  const uniq = new Map(merged.map((s) => [s.word, s]))
  const list = [...uniq.values()].sort((a, b) => a.level - b.level || a.word.localeCompare(b.word))
  // レベル別ファイル（遅延読み込み用）を再生成し、index の件数も更新する
  const dirUrl = (p) => new URL(`../src/content/wordSentences/${p}`, import.meta.url)
  const counts = {}
  for (const lv of [1, 2, 3, 4]) {
    const arr = list.filter((s) => s.level === lv)
    counts[lv] = arr.length
    writeFileSync(
      dirUrl(`L${lv}.js`),
      `// 単語例文 L${lv}（自動分割。生成は scripts/gen-sentences→merge-sentences）。\nexport default [\n${arr.map(line).join('\n')}\n]\n`,
    )
  }
  writeFileSync(
    dirUrl('index.js'),
    '// 単語例文の遅延読み込み。初回バンドルに全例文を含めないよう、レベル別に分割し動的importする。\n' +
      '// アプリ側はこの index 経由でアクセス（静的に全件 import しないこと）。Node ツールは ./all.js を使う。\n' +
      `export const WSENT_COUNTS = ${JSON.stringify(counts)}\n` +
      "const loaders = { 1: () => import('./L1.js'), 2: () => import('./L2.js'), 3: () => import('./L3.js'), 4: () => import('./L4.js') }\n" +
      'export const loadWsentLevel = (level) => loaders[level]().then((m) => m.default)\n',
  )
  console.log(`\n✓ wordSentences/L1..L4.js を更新。合計 ${list.length}件。続けて: npm run check`)
}

process.exit(bad.length && !write ? 0 : 0)
