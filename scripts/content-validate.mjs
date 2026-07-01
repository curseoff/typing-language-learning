// 正準ソース content/words.ndjson の整合性チェック（words スコープ）。
// 形（Schema 相当）＋横断不変条件（en 一意・level=bandOf(freq)・kana 打鍵可能）を検証。
// エラーがあれば終了コード1で落ちる。実行: node scripts/content-validate.mjs
import { readFileSync } from 'node:fs'
import { WORD_THEMES, bandOf } from '../src/content/words.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'

const ROMAJI_OK = /^[a-z'.,?!-]+$/ // 変換後ローマ字に許される文字（validate-sentences と同じ）

const src = readFileSync(new URL('../content/words.ndjson', import.meta.url), 'utf8')
const lines = src.split('\n').filter((l) => l.trim())

const errors = []
const seen = new Map() // en -> 初出行

lines.forEach((l, idx) => {
  const ln = idx + 1
  let w
  try {
    w = JSON.parse(l)
  } catch {
    errors.push(`行${ln}: 不正な JSON`)
    return
  }
  const err = (m) => errors.push(`行${ln} (${w.en ?? '?'}): ${m}`)

  if (typeof w.en !== 'string' || !w.en) err('en が空')
  if (typeof w.ja !== 'string' || !w.ja) err('ja が空')
  if (typeof w.kana !== 'string' || !w.kana) err('kana が空')
  if (!Number.isInteger(w.level) || w.level < 1 || w.level > 4) err(`level 不正: ${w.level}`)
  if (w.theme != null && !WORD_THEMES.includes(w.theme)) err(`theme 不正: ${w.theme}`)

  if (w.freq != null) {
    if (!Number.isInteger(w.freq) || w.freq < 0) err(`freq 不正: ${w.freq}`)
    else if (bandOf(w.freq) !== w.level) {
      err(`level≠bandOf(freq): level=${w.level} freq=${w.freq}→${bandOf(w.freq)}`)
    }
  }

  if (typeof w.en === 'string' && w.en) {
    if (seen.has(w.en)) err(`en 重複（初出 行${seen.get(w.en)}）`)
    else seen.set(w.en, ln)
  }

  if (typeof w.kana === 'string' && w.kana) {
    const roma = toRomaji(w.kana)
    if (!ROMAJI_OK.test(roma)) err(`kana をローマ字化できません → "${roma}"`)
    else if (kanaConsumed(w.kana, roma) !== [...w.kana].length) err(`kana が打鍵不能: ${w.kana}`)
  }
})

if (errors.length) {
  console.error(`✗ content:validate words: ${errors.length} 件のエラー`)
  errors.slice(0, 50).forEach((e) => console.error('  ' + e))
  if (errors.length > 50) console.error(`  …ほか ${errors.length - 50} 件`)
  process.exit(1)
}
console.log(`✓ content:validate words: ${lines.length} 件 OK`)
