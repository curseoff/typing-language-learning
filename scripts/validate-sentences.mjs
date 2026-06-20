// 問題文データ(src/sentences.js)の整合性チェック。
// 実行: npm run validate
// エラーがあれば終了コード1で落ちる(警告は落とさない)。
import { SENTENCES, RANKS } from '../src/sentences.js'
import { toRomaji, kanaConsumed } from '../src/romaji.js'

const RANK_SET = new Set(RANKS.map((r) => r.rank))
const ROMAJI_OK = /^[a-z'.,?!-]+$/ // 変換後ローマ字に許される文字
const TRAILING_PUNCT = /[。、？！]$/

// 英文末尾 → 期待する和文末尾
const PUNCT_MAP = { '.': '。', '?': '？', '!': '！' }

const errors = []
const warnings = []
const seenEn = new Map()

const label = (i, s) => `#${i + 1} "${s?.en ?? '(en無し)'}"`

SENTENCES.forEach((s, i) => {
  const id = label(i, s)
  const err = (m) => errors.push(`${id}: ${m}`)
  const warn = (m) => warnings.push(`${id}: ${m}`)

  // 必須フィールド
  for (const f of ['rank', 'en', 'ja', 'kana', 'jaWords']) {
    if (s[f] === undefined || s[f] === null) err(`必須フィールド "${f}" がありません`)
  }
  if (!s.en || !s.ja || !s.kana || !Array.isArray(s.jaWords)) return // 続行不能

  // rank
  if (!RANK_SET.has(s.rank)) err(`不正な rank: ${s.rank}（有効: ${[...RANK_SET].join(',')}）`)

  // 重複 en
  if (seenEn.has(s.en)) warn(`英文が重複（#${seenEn.get(s.en) + 1} と同じ）`)
  else seenEn.set(s.en, i)

  // 読み → ローマ字
  const roma = toRomaji(s.kana)
  if (!ROMAJI_OK.test(roma)) {
    err(`読みにローマ字変換できない文字があります → "${roma}"（kana: ${s.kana}）`)
  }
  // 長音ハイフン(ー)はタイプしづらいので避ける
  if (roma.includes('-') || s.kana.includes('ー')) {
    warn(`長音「ー」が含まれます（ローマ字でハイフン入力になる）: ${s.kana}`)
  }
  // canonical が読みを完全に消費するか(=読みとローマ字の整合)
  if (kanaConsumed(s.kana, roma) !== [...s.kana].length) {
    warn(`canonical が読みを完全消費していません（kana: ${s.kana} → ${roma}）`)
  }

  // jaWords を連結すると ja(句読点除く)になるか
  const joined = s.jaWords.join('')
  const jaBody = s.ja.replace(TRAILING_PUNCT, '')
  if (joined !== jaBody) {
    err(`jaWords の連結が ja と不一致\n    連結: "${joined}"\n    期待: "${jaBody}"`)
  }
  if (s.jaWords.some((w) => w === '')) err('jaWords に空文字が含まれます')

  // 文末記号の対応（英 . → 和 。 / 英 ? → 和 ？）
  const enEnd = s.en.slice(-1)
  const expectJa = PUNCT_MAP[enEnd]
  if (expectJa) {
    if (s.ja.slice(-1) !== expectJa) err(`文末記号不一致: 英文 "${enEnd}" なら和文末は "${expectJa}" にする`)
    if (s.kana.slice(-1) !== expectJa) err(`読みの文末記号が "${expectJa}" ではありません: ${s.kana}`)
  }
})

// ランク別の件数と注意
const dist = {}
for (const s of SENTENCES) dist[s.rank] = (dist[s.rank] || 0) + 1
const THIN = 14 // 1ゲームで使う目安。これ未満は繰り返しが増える
console.log('— ランク別件数 —')
for (const r of RANKS) {
  const n = dist[r.rank] || 0
  const flag = n < THIN ? `  ⚠ 少なめ(<${THIN})` : ''
  console.log(`  R${r.rank} ${r.label}: ${n}${flag}`)
}
console.log(`  合計: ${SENTENCES.length}\n`)

if (warnings.length) {
  console.log(`⚠ 警告 ${warnings.length}件`)
  for (const w of warnings) console.log('  - ' + w)
  console.log('')
}

if (errors.length) {
  console.log(`✖ エラー ${errors.length}件`)
  for (const e of errors) console.log('  - ' + e)
  console.log('\n検証に失敗しました。')
  process.exit(1)
}

console.log(`✓ 検証OK（${SENTENCES.length}文・エラーなし）`)
