// 「次に打てば正解になる1キー」「必ずミスになる1キー」を求める純ロジック（#446）。
// 2ブラウザ E2E ドライバ（DEV 限定フック）が、答えの文字列を外へ出さずに打鍵を組み立てるために使う。
// 判定は既存の acceptsRomaji / isKanaComplete（romajiVariants が正本）を再利用する＝新しいローマ字表は作らない。
// 純粋・React/DOM/乱数 非依存・決定的・引数非破壊。
import { acceptsRomaji } from '../romaji/input.service.js'

// 候補キーの決定的な走査順。英小文字＋「'」（ん＝n'）＋「-」（長音ー）。
// 順序を固定することで、同じ引数なら常に同じキーを返す（決定性）。
const CANDIDATES = [...'abcdefghijklmnopqrstuvwxyz', "'", '-']

// 引数の正規化（target は非空文字列のみ有効・input 未指定は空入力・kana は空/null なら素の文字列入力）。
// 不正なら null を返し、呼び出し側は即 null で応答する。
function normalize({ target, kana, input }) {
  if (typeof target !== 'string' || target.length === 0) return null
  return {
    kana: typeof kana === 'string' && kana.length > 0 ? kana : null,
    input: typeof input === 'string' ? input : '',
  }
}

// かな入力：input+c が「まだ打ち切っていない綴りの前方一致」になる最初の候補キーを返す。
// acceptsRomaji は「input+c を先頭に持つ綴りが在るか」＝1キー伸ばせるかの判定そのもの。
//   ・打ち切り済み（例 か+'ka'）は、どの候補も受理されない＝null になる（別途の完了判定は要らない）。
//   ・不正な入力途中（例 か+'z'）も同様に null。
function nextKanaKey(kana, input) {
  for (const c of CANDIDATES) {
    if (acceptsRomaji(kana, input + c)) return c
  }
  return null
}

// 次に打てば正解として1つ進むキー（1文字）。無ければ null。
//   kana あり … かな入力（ローマ字の綴り違いは acceptsRomaji が吸収する）
//   kana 無し … 素の文字列入力（target の未入力位置の1文字）
export function nextKeyFor({ target, kana, input } = {}) {
  const norm = normalize({ target, kana, input })
  if (!norm) return null
  if (norm.kana) return nextKanaKey(norm.kana, norm.input)
  return norm.input.length < target.length ? target[norm.input.length] : null
}

// 必ずミスになるキー（1文字）。無ければ null。
// 「そもそも正解キーが存在しない局面（打ち切り済み・不正な入力途中・target 不正）」では
// ミスも定義できないので null を返す（nextKeyFor と null の条件を揃える）。
export function wrongKeyFor({ target, kana, input } = {}) {
  const norm = normalize({ target, kana, input })
  if (!norm) return null
  const correct = nextKeyFor({ target, kana, input })
  if (correct == null) return null
  if (norm.kana) {
    for (const c of CANDIDATES) {
      if (!acceptsRomaji(norm.kana, norm.input + c)) return c
    }
    return null
  }
  return CANDIDATES.find((c) => c !== correct) ?? null
}
