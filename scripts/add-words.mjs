// 単語追加の事前チェック＋読み自動生成ツール。
//
// 使い方:
//   node scripts/add-words.mjs candidates.tsv            # 検査して結果表示（words.jsは変更しない）
//   node scripts/add-words.mjs candidates.tsv --write    # OKの語を words.js 末尾に追記
//
// 入力（TSV / CSV、1行1語。ヘッダ不要）:
//   en <TAB> ja <TAB> freq <TAB> theme(任意) <TAB> kana(任意)
//   ・kana を空にすると ja から自動生成（kuroshiro）。生成は要レビュー。
//   ・theme は 日常/旅行/ビジネス または空。
// JSON配列（.json）も可: [{ "en", "ja", "freq", "theme?", "kana?" }]
//
// 検査内容（words.js / validate と同じ規則）:
//   - en: 英小文字のみ・既存および入力内で重複なし
//   - freq: 正の整数 / level は bandOf(freq) に自動設定
//   - kana: ローマ字変換可能・読みを完全消費・長音「ー」は警告
//   - theme: 日常/旅行/ビジネス か空

import { readFileSync } from 'node:fs'
import { WORD_THEMES, bandOf } from '../src/content/words.js'
import { readNdjson, writeNdjson, runContentBuild } from './lib/ndjson.mjs'
import { WORDS } from '../src/content/wordsAll.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'

const EN_OK = /^[a-z]+$/
const ROMAJI_OK = /^[a-z'.,?!-]+$/
const THEME_SET = new Set(WORD_THEMES)
const existingEn = new Set(WORDS.map((w) => w.en))

// ---- 入力パース ----
const file = process.argv[2]
const write = process.argv.includes('--write')
if (!file) {
  console.error('使い方: node scripts/add-words.mjs <candidates.tsv|.json> [--write]')
  process.exit(2)
}
const raw = readFileSync(file, 'utf-8') // 実行時のカレントディレクトリ基準

function parseInput(text, path) {
  if (path.endsWith('.json')) return JSON.parse(text)
  // TSV/CSV: タブ優先、無ければカンマ
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const cols = line.includes('\t') ? line.split('\t') : line.split(',')
      const [en, ja, freq, theme, kana] = cols.map((c) => (c ?? '').trim())
      return { en, ja, freq: Number(freq), theme: theme || undefined, kana: kana || undefined }
    })
}

const candidates = parseInput(raw, file)

// ---- 読み自動生成（kuroshiro）。使えなければ kana 必須にフォールバック ----
let convert = null
try {
  const Kuroshiro = (await import('kuroshiro')).default
  const KuromojiAnalyzer = (await import('kuroshiro-analyzer-kuromoji')).default
  const K = Kuroshiro.default ?? Kuroshiro
  const A = KuromojiAnalyzer.default ?? KuromojiAnalyzer
  const ks = new K()
  await ks.init(new A())
  // カタカナ→ひらがなも一段かける（メロン→めろん 等）
  const toHira = (s) =>
    s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  convert = async (ja) => toHira(await ks.convert(ja, { to: 'hiragana' }))
} catch {
  console.warn('⚠ kuroshiro を読み込めませんでした。kana 列を手動で埋めてください。\n')
}

// ---- 検査 ----
const seenEn = new Set()
const ok = []
const ng = []

for (let i = 0; i < candidates.length; i++) {
  const c = candidates[i]
  const id = `#${i + 1} "${c.en || '(en無し)'}"`
  const errs = []
  const warns = []

  // kana 自動生成（未指定時）
  let auto = false
  if (!c.kana && c.ja && convert) {
    c.kana = await convert(c.ja)
    auto = true
  }

  if (!c.en) errs.push('en が空')
  else if (!EN_OK.test(c.en)) errs.push(`en は英小文字のみ → "${c.en}"`)
  else if (existingEn.has(c.en)) errs.push('en が既存と重複')
  else if (seenEn.has(c.en)) errs.push('en が入力内で重複')

  if (!c.ja) errs.push('ja が空')
  if (!Number.isInteger(c.freq) || c.freq <= 0) errs.push(`freq は正の整数 → ${c.freq}`)
  if (c.theme !== undefined && !THEME_SET.has(c.theme)) errs.push(`不正な theme → ${c.theme}`)

  if (!c.kana) errs.push('kana が空（自動生成も不可）')
  else {
    const roma = toRomaji(c.kana)
    if (!ROMAJI_OK.test(roma)) errs.push(`読みをローマ字変換できない → "${roma}"（${c.kana}）`)
    if (c.kana.includes('ー') || roma.includes('-')) warns.push(`長音「ー」を含む: ${c.kana}`)
    if (kanaConsumed(c.kana, roma) !== [...c.kana].length)
      warns.push(`読みを完全消費できない（${c.kana} → ${roma}）`)
  }

  const level = Number.isInteger(c.freq) && c.freq > 0 ? bandOf(c.freq) : null
  if (errs.length) {
    ng.push({ id, c, errs, warns })
  } else {
    if (c.en) { seenEn.add(c.en); existingEn.add(c.en) } // 後続の重複も検出
    ok.push({ ...c, level, auto, warns })
  }
}

// ---- 出力 ----
const jsLine = (w) => {
  const t = w.theme ? `, theme: '${w.theme}'` : ''
  return `  { en: '${w.en}', ja: '${w.ja}', kana: '${w.kana}', freq: ${w.freq}, level: ${w.level}${t} },`
}

console.log(`\n=== 検査結果: 候補 ${candidates.length} / OK ${ok.length} / NG ${ng.length} ===\n`)
for (const w of ok) {
  const tags = [w.auto ? '読み自動' : '', ...w.warns.map((x) => `⚠${x}`)].filter(Boolean)
  console.log(`OK  ${w.en}\t${w.ja}\t${w.kana}\tL${w.level}${tags.length ? '  [' + tags.join(' / ') + ']' : ''}`)
}
if (ng.length) {
  console.log('')
  for (const x of ng) console.log(`NG  ${x.id}: ${x.errs.join(' / ')}`)
}

console.log(`\n--- 追記用（OK ${ok.length}語）---`)
for (const w of ok) console.log(jsLine(w))

// ---- 書き込み（正準ソース content/words.ndjson に追記 → 生成物を再生成）----
if (write && ok.length) {
  const url = new URL('../content/words.ndjson', import.meta.url)
  // 検査で付与した auto/warns は落とし、単語の正準フィールドだけ残す。
  const clean = ok.map((w) => ({
    en: w.en,
    ja: w.ja,
    kana: w.kana,
    freq: w.freq,
    level: w.level,
    ...(w.theme != null ? { theme: w.theme } : {}),
  }))
  writeNdjson(url, [...readNdjson(url), ...clean])
  runContentBuild()
  console.log(`\n✓ content/words.ndjson に ${ok.length}語を追記し生成物を再生成しました。続けて: npm run check`)
} else if (write) {
  console.log('\n(OKが0語のため書き込みませんでした)')
}

process.exit(ng.length ? 1 : 0)
