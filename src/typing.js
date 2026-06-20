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

// 英文を単語チップ用に分割（末尾の句読点は独立チップ）
export function enWords(en) {
  const m = en.match(/^(.*?)\s*([.?!]+)\s*$/)
  if (m) return [...m[1].split(/\s+/), m[2]]
  return en.split(/\s+/)
}

// 和文末尾の句読点(。、！？)を取り出す（チップに加えるため）
export function jaPunct(ja) {
  return (ja.match(/[。、！？]$/) || [])[0]
}

export function scramble(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// モードに応じて、1つの文(item)を打つためのセグメント列を返す。
// en=英語 / ja=日本語 / both=英→日 / en-tr=英訳(伏せ) / ja-tr=日本語訳(伏せ)
// 翻訳モードでは chips(単語チップ)を付与する。
export function buildUnits(item, mode) {
  switch (mode) {
    case 'ja':
      return [jaSeg(item, false)]
    case 'both':
      return [enSeg(item, false), jaSeg(item, false)]
    case 'en-tr': {
      const s = enSeg(item, true)
      const words = enWords(item.en)
      s.words = words
      // chips は {text, i}(元の語順index)。表示はシャッフル。
      s.chips = scramble(words.map((text, i) => ({ text, i })))
      return [s]
    }
    case 'ja-tr': {
      const s = jaSeg(item, true)
      const words = item.jaWords ? [...item.jaWords] : [item.ja]
      s.words = words
      s.chips = scramble(words.map((text, i) => ({ text, i })))
      return [s]
    }
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

// 英文の各 enWords の終端位置(seg.en 内, 単一スペース想定)
function enWordEnds(en) {
  const m = en.match(/^(.*?)\s*([.?!]+)\s*$/)
  const body = m ? m[1] : en
  const words = body.split(/\s+/)
  const ends = []
  let cum = 0
  for (const w of words) {
    cum += w.length
    ends.push(cum)
    cum += 1 // スペース
  }
  if (m) ends.push(en.length) // 末尾句読点
  return ends
}

// 入力 input が、語順の先頭から何単語ぶん打ち終えたか（チップ消費数）
export function consumedWords(seg, input) {
  if (!seg.words || seg.words.length === 0) return 0
  if (seg.type === 'ja') {
    const consumed = kanaConsumed(seg.kana, input)
    const ends = alignJaToKana(seg.ja, seg.kana)
    let cum = 0
    let count = 0
    for (const w of seg.words) {
      cum += [...w].length
      const kanaEnd = ends[cum - 1] ?? Infinity
      if (kanaEnd <= consumed) count++
      else break
    }
    return count
  }
  let count = 0
  for (const e of enWordEnds(seg.en)) {
    if (e <= input.length) count++
    else break
  }
  return count
}
