// 正準ソース content/*.ndjson の整合性チェック（構造＋一意性）。
// 深い意味検証（dict⊆words・jaWords連結=ja・全 kana 打鍵可 等）は生成物に対して
// validate-sentences.mjs が担うため、ここは NDJSON の構造・型・一意性に集中する。
// words だけは早期ガードとして深めに検査する。エラーがあれば終了コード1。
// 実行: node scripts/content-validate.mjs
import { readFileSync } from 'node:fs'
import { WORD_THEMES, bandOf } from '../src/content/words.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'

const ROMAJI_OK = /^[a-z'.,?!-]+$/
const u = (p) => new URL(p, import.meta.url)
const errors = []
const readLines = (rel) =>
  readFileSync(u('../' + rel), 'utf8')
    .split('\n')
    .filter((l) => l.trim())

// 1行ずつ parse して cb(obj, pushErr, lineNo) を呼ぶ。壊れた JSON は記録。
function forEachRecord(rel, cb) {
  readLines(rel).forEach((l, i) => {
    const ln = i + 1
    let o
    try {
      o = JSON.parse(l)
    } catch {
      errors.push(`${rel} 行${ln}: 不正な JSON`)
      return
    }
    cb(o, (m) => errors.push(`${rel} 行${ln}: ${m}`), ln)
  })
}

const isStr = (v) => typeof v === 'string' && v.length > 0
const isLevel = (v) => Number.isInteger(v) && v >= 1 && v <= 4

// ---- words（早期ガード：深め）----
{
  const seen = new Map()
  forEachRecord('content/words.ndjson', (w, err, ln) => {
    if (!isStr(w.en)) err('en が空')
    if (!isStr(w.ja)) err('ja が空')
    if (!isStr(w.kana)) err('kana が空')
    if (!isLevel(w.level)) err(`level 不正: ${w.level}`)
    if (w.theme != null && !WORD_THEMES.includes(w.theme)) err(`theme 不正: ${w.theme}`)
    if (w.freq != null) {
      if (!Number.isInteger(w.freq) || w.freq < 0) err(`freq 不正: ${w.freq}`)
      else if (bandOf(w.freq) !== w.level) err(`level≠bandOf(freq): ${w.level}≠${bandOf(w.freq)}`)
    }
    if (isStr(w.en)) {
      if (seen.has(w.en)) err(`en 重複（初出 行${seen.get(w.en)}）`)
      else seen.set(w.en, ln)
    }
    if (isStr(w.kana)) {
      const roma = toRomaji(w.kana)
      if (!ROMAJI_OK.test(roma)) err(`kana をローマ字化できません → "${roma}"`)
      else if (kanaConsumed(w.kana, roma) !== [...w.kana].length) err(`kana 打鍵不能: ${w.kana}`)
    }
  })
}

// ---- dict（英英）：構造＋def は英小文字＋空白のみ ----
forEachRecord('content/dict.ndjson', (d, err) => {
  if (!isStr(d.word)) err('word が空')
  if (!isStr(d.def)) err('def が空')
  else if (!/^[a-z ]+$/.test(d.def)) err(`def は英小文字＋空白のみ: "${d.def}"`)
  if (!isStr(d.ja)) err('ja が空')
  if (!isStr(d.kana)) err('kana が空')
  if (!isLevel(d.level)) err(`level 不正: ${d.level}`)
  if (d.theme != null && !WORD_THEMES.includes(d.theme)) err(`theme 不正: ${d.theme}`)
})

// ---- gloss（en→ja）：構造＋en 一意 ----
{
  const seen = new Map()
  forEachRecord('content/gloss.ndjson', (g, err, ln) => {
    if (!isStr(g.en)) err('en が空')
    if (!isStr(g.ja)) err('ja が空')
    if (isStr(g.en)) {
      if (seen.has(g.en)) err(`en 重複（初出 行${seen.get(g.en)}）`)
      else seen.set(g.en, ln)
    }
  })
}

// ---- sentences（例文）：構造のみ（jaWords連結=ja 等の意味検証は validate-sentences が担う）----
forEachRecord('content/sentences.ndjson', (s, err) => {
  if (!isLevel(s.level)) err(`level 不正: ${s.level}`)
  if (!isStr(s.word)) err('word が空')
  if (!isStr(s.en)) err('en が空')
  if (!isStr(s.ja)) err('ja が空')
  if (!isStr(s.kana)) err('kana が空')
  if (!Array.isArray(s.jaWords) || !s.jaWords.every((w) => typeof w === 'string')) {
    err('jaWords が文字列配列でない')
  }
})

if (errors.length) {
  console.error(`✗ content:validate: ${errors.length} 件のエラー`)
  errors.slice(0, 50).forEach((e) => console.error('  ' + e))
  if (errors.length > 50) console.error(`  …ほか ${errors.length - 50} 件`)
  process.exit(1)
}
console.log('✓ content:validate: words/dict/gloss/sentences すべて OK')
