// カタカナ長音語の読みを「ー」表記に正規化する。
// 例: チーム=ちいむ / ケーキ=けき(脱落) → ちーむ / けーき（ー は "-" で打鍵）。
// ja のカタカナ長音ランの位置を alignJaToKana で特定し、その読み範囲だけを安全に置換する
//（単純な部分一致だと「ドレス」内の「れす」を「レース」と誤爆するため）。
//   node scripts/normalize-chouon.mjs           # ドライラン（変換結果を表示）
//   node scripts/normalize-chouon.mjs --write    # L1..L4.js を再生成
import { writeFileSync } from 'node:fs'
import { alignJaToKana } from '../src/domain/typing/progress.js'
import { toRomaji, kanaConsumed } from '../src/domain/romaji/romaji.js'
import L1 from '../src/content/wordSentences/L1.js'
import L2 from '../src/content/wordSentences/L2.js'
import L3 from '../src/content/wordSentences/L3.js'
import L4 from '../src/content/wordSentences/L4.js'

const write = process.argv.includes('--write')
const kataToHira = (c) => {
  const code = c.codePointAt(0)
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c
}
// 小書き拗音/捨て仮名の母音
const SMALL = { ゃ: 'a', ゅ: 'u', ょ: 'o', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', っ: '' }
const vowelOf = (h) => {
  if (SMALL[h] !== undefined) return SMALL[h]
  const r = toRomaji(h)
  return r ? r[r.length - 1] : ''
}
const longVariants = (v) => ({ a: ['あ'], i: ['い'], u: ['う'], e: ['え', 'い'], o: ['お', 'う'] }[v] || [])

// target(ー入り) から、旧読みの候補（母音重ねの全変種＋脱落）を作る
function oldForms(target) {
  let forms = ['']
  for (const ch of target) {
    if (ch === 'ー') {
      forms = forms
        .map((f) => {
          const last = f[f.length - 1]
          return longVariants(last ? vowelOf(last) : 'a').map((x) => f + x)
        })
        .flat()
    } else {
      forms = forms.map((f) => f + ch)
    }
  }
  const dropped = target.replace(/ー/g, '')
  // 長い候補を優先（脱落より重ねを先に確定）
  return [...new Set([...forms, dropped])].sort((a, b) => b.length - a.length)
}

const KATA_RUN = /[ァ-ー]+/g // カタカナ＋長音ー

function normalizeKana(ja, kana) {
  const align = alignJaToKana(ja, kana)
  const reps = [] // {start, len, target}
  let unmatched = []
  let m
  while ((m = KATA_RUN.exec(ja)) !== null) {
    if (!m[0].includes('ー')) continue
    const run = m[0]
    const startChar = m.index
    const endChar = startChar + [...run].length - 1
    const target = [...run].map((c) => (c === 'ー' ? 'ー' : kataToHira(c))).join('')
    const spanStart = startChar === 0 ? 0 : align[startChar - 1]
    const spanEnd = align[endChar]
    const span = kana.slice(spanStart, spanEnd)
    // span が候補と完全一致、または候補が span の接頭辞（脱落で次語を巻き込んだ場合）
    const cand = oldForms(target).find((c) => c && (span === c || span.startsWith(c)))
    if (cand) reps.push({ start: spanStart, len: cand.length, target })
    else unmatched.push({ run, target, span })
  }
  // 右から適用（前方のindexを保つ）
  let out = kana
  reps.sort((a, b) => b.start - a.start).forEach((r) => {
    out = out.slice(0, r.start) + r.target + out.slice(r.start + r.len)
  })
  return { kana: out, unmatched }
}

const files = { 1: L1, 2: L2, 3: L3, 4: L4 }
let changed = 0
const flagged = []
const updated = { 1: [...L1], 2: [...L2], 3: [...L3], 4: [...L4] }
for (const lv of [1, 2, 3, 4]) {
  updated[lv] = files[lv].map((s) => {
    if (!/ー/.test(s.ja)) return s
    const { kana, unmatched } = normalizeKana(s.ja, s.kana)
    if (unmatched.length) flagged.push({ word: s.word, ja: s.ja, kana: s.kana, unmatched })
    if (kana !== s.kana) {
      // 検証：ローマ字化でき、読みを完全消費すること
      const roma = toRomaji(kana)
      if (!/^[a-z'.,?!-]+$/.test(roma) || kanaConsumed(kana, roma) !== [...kana].length) {
        flagged.push({ word: s.word, ja: s.ja, kana: s.kana, bad: kana })
        return s
      }
      changed++
      return { ...s, kana }
    }
    return s
  })
}

console.log(`正規化: ${changed} 文を「ー」表記に変換`)
if (flagged.length) {
  console.log(`\n要手当 ${flagged.length} 件（自動変換せず）:`)
  flagged.forEach((f) =>
    console.log(`  ${f.word}: ja=${f.ja}\n    kana=${f.kana}${f.bad ? ` -> NG:${f.bad}` : ''}`),
  )
}

if (write) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const line = (s) =>
    `  { level: ${s.level}, word: '${esc(s.word)}', en: '${esc(s.en)}', ja: '${esc(s.ja)}', kana: '${esc(s.kana)}', jaWords: [${s.jaWords.map((w) => `'${esc(w)}'`).join(', ')}] },`
  for (const lv of [1, 2, 3, 4]) {
    const url = new URL(`../src/content/wordSentences/L${lv}.js`, import.meta.url)
    writeFileSync(
      url,
      `// 単語例文 L${lv}（自動分割。生成は scripts/gen-sentences→merge-sentences）。\nexport default [\n${updated[lv].map(line).join('\n')}\n]\n`,
    )
  }
  console.log('\n✓ L1..L4.js を再生成しました。続けて: npm run validate / npm run check')
}
