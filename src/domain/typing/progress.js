// 入力の進捗計算（表示ローマ字・漢字位置・単語チップ消費）。
import { kanaConsumed } from '../romaji/romaji.js'

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
        // 送り仮名の検索開始は ki+漢字数（各漢字は最低1かな消費）。
        // これで読みに同じかなが複数あっても、漢字内の先頭かなへ誤マッチしない。
        const p = hira.indexOf(toH(next.chars[0]), ki + tok.chars.length)
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

// ルビ表示用：ja を「漢字の連なり」と「かな等」に分割し、漢字runには読み(ruby)を付ける。
// 返り値 [{ chars:[...], from:先頭のja文字index, ruby:読み|null }]
export function rubyParts(ja, kana) {
  const ends = alignJaToKana(ja, kana)
  const kanaArr = [...kana]
  const jaChars = [...ja]
  const isKanaCh = (c) => {
    const code = c.codePointAt(0)
    return (code >= 0x3040 && code <= 0x30ff) || '。、？！'.includes(c)
  }
  const parts = []
  let i = 0
  while (i < jaChars.length) {
    if (!isKanaCh(jaChars[i])) {
      const start = i
      while (i < jaChars.length && !isKanaCh(jaChars[i])) i++
      const startKana = start === 0 ? 0 : ends[start - 1]
      const endKana = ends[i - 1]
      parts.push({
        chars: jaChars.slice(start, i),
        from: start,
        ruby: kanaArr.slice(startKana, endKana).join(''),
      })
    } else {
      parts.push({ chars: [jaChars[i]], from: i, ruby: null })
      i++
    }
  }
  // 送り仮名が漢字の読み内にも現れる等でスライスが読み全体を覆えない場合は、
  // 語全体に1つのルビを当てる（読みは常に正しくなる）。
  const covered = parts.reduce((n, p) => n + (p.ruby ? [...p.ruby].length : p.chars.length), 0)
  const hasKanji = parts.some((p) => p.ruby !== null)
  if (hasKanji && covered !== kanaArr.length) {
    return [{ chars: jaChars, from: 0, ruby: kana }]
  }
  return parts
}

// 漢字の「打ち終えた文字数」
export function kanjiDone(seg, input) {
  const consumed = kanaConsumed(seg.kana, input)
  const ends = alignJaToKana(seg.ja, seg.kana)
  let n = 0
  for (const e of ends) if (e <= consumed) n++
  return n
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
