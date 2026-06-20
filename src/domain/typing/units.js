// 入力ユニットの生成（モード別のセグメント列・単語チップ）。
import { romajiVariants, toRomaji } from '../romaji/romaji.js'

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
      // jaWords が末尾句読点を含まない場合（マラソンのデータ）は補い、ja を再構成できるようにする
      if (words.join('') !== item.ja) {
        const p = jaPunct(item.ja)
        if (p) words.push(p)
      }
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
