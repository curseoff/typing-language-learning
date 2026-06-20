// モード別の入力ユニット生成と進捗ヘルパー（マラソンと物語モードで共有）。
import { romajiVariants, toRomaji, kanaConsumed } from './romaji.js'

export { kanaConsumed }

// 入力中セグメントの表示ローマ字（canonical優先、入力に合う最短へ切替）
export function guideText(seg, input) {
  if (seg.canonical.startsWith(input)) return seg.canonical
  let best = null
  for (const v of seg.variants) {
    if (v.startsWith(input) && (best === null || v.length < best.length)) best = v
  }
  return best ?? seg.canonical
}

// 漢字表記(ja)の各文字が、読み(kana)の何文字目までに対応するか
export function alignJaToKana(ja, kana) {
  const toH = (c) => {
    const code = c.charCodeAt(0)
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c
  }
  const isKana = (c) => {
    const code = c.codePointAt(0)
    return (code >= 0x3040 && code <= 0x30ff) || c === '。' || c === '、' || c === '？' || c === '！'
  }
  const jaChars = [...ja]
  const hira = [...kana].map(toH).join('')
  const tokens = []
  for (const c of jaChars) {
    const type = isKana(c) ? 'kana' : 'kanji'
    const last = tokens[tokens.length - 1]
    if (last && last.type === type) last.chars.push(c)
    else tokens.push({ type, chars: [c] })
  }
  const kanaEndOf = []
  let ki = 0
  tokens.forEach((tok, ti) => {
    if (tok.type === 'kana') {
      for (let j = 0; j < tok.chars.length; j++) {
        ki = Math.min(ki + 1, hira.length)
        kanaEndOf.push(ki)
      }
    } else {
      const next = tokens[ti + 1]
      let anchor = hira.length
      if (next) {
        const p = hira.indexOf(toH(next.chars[0]), ki)
        if (p >= 0) anchor = p
      }
      const start = ki
      const span = Math.max(anchor - start, 0)
      const K = tok.chars.length
      for (let j = 0; j < K; j++) kanaEndOf.push(start + Math.round(((j + 1) * span) / K))
      ki = anchor
    }
  })
  return kanaEndOf
}

// 漢字の「打ち終えた文字数」
export function kanjiDone(seg, input) {
  const consumed = kanaConsumed(seg.kana, input)
  const ends = alignJaToKana(seg.ja, seg.kana)
  let n = 0
  for (const e of ends) if (e <= consumed) n++
  return n
}

function enSeg(item, translate) {
  return { type: 'en', en: item.en, ja: item.ja, kana: item.kana, variants: [item.en], canonical: item.en, translate }
}
function jaSeg(item, translate) {
  return {
    type: 'ja',
    en: item.en,
    ja: item.ja,
    kana: item.kana,
    variants: romajiVariants(item.kana),
    canonical: toRomaji(item.kana),
    translate,
  }
}

// モードに応じて、1つの文(item)を打つためのセグメント列を返す。
// en=英語 / ja=日本語 / both=英→日 / en-tr=英訳(伏せ) / ja-tr=日本語訳(伏せ)
export function buildUnits(item, mode) {
  switch (mode) {
    case 'ja':
      return [jaSeg(item, false)]
    case 'both':
      return [enSeg(item, false), jaSeg(item, false)]
    case 'en-tr':
      return [enSeg(item, true)]
    case 'ja-tr':
      return [jaSeg(item, true)]
    case 'en':
    default:
      return [enSeg(item, false)]
  }
}

// そのモードで「実際に打つ言語」
export function typingLang(mode) {
  return mode === 'ja' || mode === 'ja-tr' ? 'ja' : 'en'
}

// 選択肢を選ぶための(常に表示・非伏せの)セグメント
export function choiceSeg(choice, mode) {
  return typingLang(mode) === 'ja' ? jaSeg(choice, false) : enSeg(choice, false)
}

export function segMatches(seg, input) {
  return seg.variants.some((v) => v.startsWith(input))
}
