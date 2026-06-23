// 問題文データ(src/content/sentences.js)の整合性チェック。
// 実行: npm run validate
// エラーがあれば終了コード1で落ちる(警告は落とさない)。
import { SENTENCES, RANKS } from '../src/content/sentences.js'
import { WORD_SENTENCES } from '../src/content/wordSentences.js'
import { WORDS, WORD_LEVELS, WORD_THEMES, bandOf } from '../src/content/words.js'
import { DICT } from '../src/content/dictionary.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'

const RANK_SET = new Set(RANKS.map((r) => r.rank))
const ROMAJI_OK = /^[a-z'.,?!-]+$/ // 変換後ローマ字に許される文字
const TRAILING_PUNCT = /[。、？！]$/

// 英文末尾 → 期待する和文末尾
const PUNCT_MAP = { '.': '。', '?': '？', '!': '！' }

// 文章は単語の例文：word ∈ words.en、かつ例文でその語が実際に使われていること
const wordEnSet = new Set(WORDS.map((w) => w.en))
const wordBases = (t) => {
  const f = [t]
  if (t.endsWith('ies')) f.push(t.slice(0, -3) + 'y')
  if (t.endsWith('es')) f.push(t.slice(0, -2))
  if (t.endsWith('s')) f.push(t.slice(0, -1))
  if (t.endsWith('ed')) f.push(t.slice(0, -2), t.slice(0, -1))
  if (t.endsWith('ing')) f.push(t.slice(0, -3), t.slice(0, -3) + 'e')
  return f
}
const sentenceUsesWord = (en, word) => {
  const toks = en.toLowerCase().match(/[a-z]+/g) || []
  return toks.some((t) => t === word || wordBases(t).includes(word))
}

const errors = []
const warnings = []
const seenEn = new Map()

const label = (i, s) => `#${i + 1} "${s?.en ?? '(en無し)'}"`

SENTENCES.forEach((s, i) => {
  const id = label(i, s)
  const err = (m) => errors.push(`${id}: ${m}`)
  const warn = (m) => warnings.push(`${id}: ${m}`)

  // 必須フィールド
  for (const f of ['rank', 'word', 'en', 'ja', 'kana', 'jaWords']) {
    if (s[f] === undefined || s[f] === null) err(`必須フィールド "${f}" がありません`)
  }
  if (!s.en || !s.ja || !s.kana || !Array.isArray(s.jaWords)) return // 続行不能

  // rank
  if (!RANK_SET.has(s.rank)) err(`不正な rank: ${s.rank}（有効: ${[...RANK_SET].join(',')}）`)

  // 文章は単語の例文：word は単語に存在し、例文で実際に使われていること
  if (s.word !== undefined) {
    if (!wordEnSet.has(s.word)) err(`word が単語(words.js)に存在しません → "${s.word}"`)
    else if (!sentenceUsesWord(s.en, s.word)) err(`例文に単語 "${s.word}" が使われていません`)
  }

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

// ---- 単語データ(words.js)の検証 ----
const EN_OK = /^[a-z]+$/
const LEVEL_SET = new Set(WORD_LEVELS.map((l) => l.level))
const THEME_SET = new Set(WORD_THEMES)
const seenWordEn = new Map()

WORDS.forEach((w, i) => {
  const id = `単語#${i + 1} "${w?.en ?? '(en無し)'}"`
  const err = (m) => errors.push(`${id}: ${m}`)
  const warn = (m) => warnings.push(`${id}: ${m}`)

  for (const f of ['en', 'ja', 'kana', 'level']) {
    if (w[f] === undefined || w[f] === null) err(`必須フィールド "${f}" がありません`)
  }
  if (!w.en || !w.ja || !w.kana) return

  if (!EN_OK.test(w.en)) err(`en は英小文字のみにする → "${w.en}"`)
  if (seenWordEn.has(w.en)) err(`en が重複（#${seenWordEn.get(w.en) + 1} と同じ）`) // 4択・照合が壊れる
  else seenWordEn.set(w.en, i)
  if (!LEVEL_SET.has(w.level)) err(`不正な level: ${w.level}`)
  if (w.theme !== undefined && !THEME_SET.has(w.theme)) err(`不正な theme: ${w.theme}`) // theme は任意
  // freq は任意。あれば正の整数で、level が頻度帯(bandOf)と一致すること
  if (w.freq !== undefined) {
    if (!Number.isInteger(w.freq) || w.freq <= 0) err(`freq は正の整数にする → ${w.freq}`)
    else if (bandOf(w.freq) !== w.level) err(`level が頻度帯と不一致（freq ${w.freq} → L${bandOf(w.freq)}、実際 L${w.level}）`)
  }

  const roma = toRomaji(w.kana)
  if (!ROMAJI_OK.test(roma)) err(`読みをローマ字変換できません → "${roma}"（kana: ${w.kana}）`)
  if (roma.includes('-') || w.kana.includes('ー')) warn(`長音「ー」が含まれます: ${w.kana}`)
  if (kanaConsumed(w.kana, roma) !== [...w.kana].length) {
    warn(`canonical が読みを完全消費していません（${w.kana} → ${roma}）`)
  }
})

// ---- 英英辞典(dictionary.js)の検証 ----
const DEF_OK = /^[a-z ]+$/ // 定義は英小文字と空白のみ（句読点なし）
const seenDictWord = new Map()
const wordByEn = new Map(WORDS.map((w) => [w.en, w])) // 英英は単語のサブセット（word ∈ words.en）

DICT.forEach((d, i) => {
  const id = `英英#${i + 1} "${d?.word ?? '(word無し)'}"`
  const err = (m) => errors.push(`${id}: ${m}`)
  const warn = (m) => warnings.push(`${id}: ${m}`)

  for (const f of ['word', 'def', 'ja', 'kana', 'level', 'theme']) {
    if (d[f] === undefined || d[f] === null) err(`必須フィールド "${f}" がありません`)
  }
  if (!d.word || !d.def || !d.ja || !d.kana) return

  if (!EN_OK.test(d.word)) err(`word は英小文字のみ → "${d.word}"`)
  if (!DEF_OK.test(d.def)) err(`def は英小文字と空白のみ → "${d.def}"`)
  if (seenDictWord.has(d.word)) err(`word が重複（#${seenDictWord.get(d.word) + 1} と同じ）`)
  else seenDictWord.set(d.word, i)
  if (!LEVEL_SET.has(d.level)) err(`不正な level: ${d.level}`)
  if (!THEME_SET.has(d.theme)) err(`不正な theme: ${d.theme}`)

  // 英英 ⊆ 単語：word は単語に存在し、level/theme も一致させる
  const w = wordByEn.get(d.word)
  if (!w) err(`word が単語(words.js)に存在しません（英英は単語のサブセット）`)
  else {
    if (w.level !== d.level) err(`level が単語と不一致（単語=L${w.level} / 英英=L${d.level}）`)
    // theme は単語側で任意。単語が theme を持つ場合だけ一致を要求する
    if (w.theme !== undefined && w.theme !== d.theme)
      err(`theme が単語と不一致（単語=${w.theme} / 英英=${d.theme}）`)
  }

  const roma = toRomaji(d.kana)
  if (!ROMAJI_OK.test(roma)) err(`読みをローマ字変換できません → "${roma}"（kana: ${d.kana}）`)
  if (roma.includes('-') || d.kana.includes('ー')) warn(`長音「ー」が含まれます: ${d.kana}`)
  if (kanaConsumed(d.kana, roma) !== [...d.kana].length) {
    warn(`canonical が読みを完全消費していません（${d.kana} → ${roma}）`)
  }
})

// ---- 単語の例文(wordSentences.js)の検証 ----
// 各文は単語の使用例：word ∈ words.en、例文で実際に使用、level は単語と一致。
const seenWS = new Map()
WORD_SENTENCES.forEach((s, i) => {
  const id = `例文#${i + 1} "${s?.word ?? '(word無し)'}"`
  const err = (m) => errors.push(`${id}: ${m}`)
  const warn = (m) => warnings.push(`${id}: ${m}`)

  for (const f of ['level', 'word', 'en', 'ja', 'kana', 'jaWords']) {
    if (s[f] === undefined || s[f] === null) err(`必須フィールド "${f}" がありません`)
  }
  if (!s.en || !s.ja || !s.kana || !Array.isArray(s.jaWords) || !s.word) return

  const w = wordByEn.get(s.word)
  if (!w) err(`word が単語(words.js)に存在しません → "${s.word}"`)
  else {
    if (!sentenceUsesWord(s.en, s.word)) err(`例文に単語 "${s.word}" が使われていません`)
    if (w.level !== s.level) err(`level が単語と不一致（単語=L${w.level} / 例文=L${s.level}）`)
  }
  if (seenWS.has(s.word)) err(`word が重複（#${seenWS.get(s.word) + 1} と同じ）`)
  else seenWS.set(s.word, i)

  const roma = toRomaji(s.kana)
  if (!ROMAJI_OK.test(roma)) err(`読みをローマ字変換できません → "${roma}"（kana: ${s.kana}）`)
  if (roma.includes('-') || s.kana.includes('ー')) warn(`長音「ー」が含まれます: ${s.kana}`)
  if (kanaConsumed(s.kana, roma) !== [...s.kana].length)
    warn(`kana が読みを完全消費していません（${s.kana} → ${roma}）`)

  const joined = s.jaWords.join('')
  const jaBody = s.ja.replace(TRAILING_PUNCT, '')
  if (joined !== jaBody) err(`jaWords の連結が ja と不一致\n    連結: "${joined}"\n    期待: "${jaBody}"`)
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

// 単語: 難易度×テーマの件数
console.log('— 単語 難易度×テーマ —')
for (const l of WORD_LEVELS) {
  const row = WORD_THEMES.map(
    (t) => `${t}:${WORDS.filter((w) => w.level === l.level && w.theme === t).length}`,
  )
  console.log(`  L${l.level} ${l.label}: ${row.join('  ')}`)
}
console.log(`  合計: ${WORDS.length}\n`)

console.log(`— 英英辞典 —  合計: ${DICT.length}\n`)

console.log(`— 単語の例文 —  合計: ${WORD_SENTENCES.length}\n`)

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

console.log(`✓ 検証OK（${SENTENCES.length}文・${WORDS.length}単語・${DICT.length}英英・${WORD_SENTENCES.length}例文・エラーなし）`)
