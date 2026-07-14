// 穴埋め学習モードの純ロジック（#402）。純粋・React/DOM 非依存。
// 入力対象の seg を「伏字(cloze)」にし、反対側の言語を hint として添える。
// 照合（variants/canonical）は buildUnits と同一に保つ（正誤判定は通常と同じ）。
import { buildUnits, enWords } from './units.service.js'

// buildUnits を基に、入力対象 seg へ cloze:true と hint（反対側の表示文字列）を付与する。
//   en   … 英語 seg を伏せ、hint は日本語(ja)
//   ja   … 読み seg を伏せ、hint は英語(en)
//   both … clozeSide（既定 'en'）で指定した片側だけを伏せ、hint に反対側を添える。
//          もう一方は通常表示（cloze/hint を付けない）。読みが作れない（kana 無し）
//          item では読み seg を作れないので英語 seg のみ返す（clozeSide='ja' でも en を伏せる）。
//          clozeSide は seed 由来で語ごとに決めて渡す（application 層で選択）。
//   en-tr/ja-tr … cloze を付けず通常 buildUnits と同等。
// item は非破壊（seg は新しいオブジェクトに複製して属性を足す）。
// 照合（variants/canonical）は buildUnits と同一（seg を複製して cloze/hint を足すだけ）。
export function buildClozeUnits(item, mode, opts = {}) {
  if (mode === 'en') {
    return buildUnits(item, 'en', opts).map((s) => ({ ...s, cloze: true, hint: item.ja }))
  }
  if (mode === 'ja') {
    return buildUnits(item, 'ja', opts).map((s) => ({ ...s, cloze: true, hint: item.en }))
  }
  if (mode === 'both') {
    // both は buildUnits を直接呼ばず en/ja に分解（読みが作れない item でクラッシュさせない）。
    const enBase = { ...buildUnits(item, 'en', opts)[0] }
    if (!item.kana) return [{ ...enBase, cloze: true, hint: item.ja }]
    const jaBase = { ...buildUnits(item, 'ja', opts)[0] }
    // clozeSide の側だけ cloze+hint、反対側は通常 seg（cloze/hint 無し）。既定は 'en'。
    if (opts.clozeSide === 'ja') {
      return [enBase, { ...jaBase, cloze: true, hint: item.en }]
    }
    return [{ ...enBase, cloze: true, hint: item.ja }, jaBase]
  }
  // 翻訳モード（en-tr/ja-tr）等は通常構造のまま（cloze を付けない）。
  return buildUnits(item, mode, opts)
}

// 既定の「内容語(content word)」判定：句読点・記号と最小限の機能語を除外する。
// 冠詞・前置詞・接続詞・be 動詞・代名詞など、意味の中心にならない語を伏字候補から外す。
const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'nor',
  'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'this', 'that', 'these', 'those',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
])

function defaultIsContent(token) {
  if (typeof token !== 'string') return false
  const w = token.trim().toLowerCase()
  if (!/[a-z]/i.test(w)) return false // 句読点・記号のみは除外
  return !FUNCTION_WORDS.has(w)
}

// 伏せるトークンの index を昇順・重複なしで選ぶ。
// content 候補（isContent が true）から min〜min(max, 候補数) 個を rng で決定的に選定する。
//   候補 0        … []
//   候補 < min    … 候補すべて（昇順）
//   それ以外      … [min, min(max, 候補数)] の範囲で個数を決め、その数だけ選ぶ
// rng 注入で決定的・非破壊。既定 isContent は defaultIsContent。
export function pickClozeTokens(tokens, { rng = Math.random, min = 1, max = 3, isContent } = {}) {
  const isC = isContent || defaultIsContent
  const candidates = []
  for (let i = 0; i < tokens.length; i++) {
    if (isC(tokens[i])) candidates.push(i)
  }
  if (candidates.length === 0) return []
  if (candidates.length < min) return candidates.slice() // 既に昇順
  const hi = Math.min(max, candidates.length)
  const lo = Math.min(min, hi)
  const count = lo + Math.floor(rng() * (hi - lo + 1))
  const pool = candidates.slice()
  const picked = []
  for (let k = 0; k < count && pool.length > 0; k++) {
    const j = Math.floor(rng() * pool.length)
    picked.push(pool.splice(j, 1)[0])
  }
  picked.sort((a, b) => a - b)
  return picked
}

// 既定のトークナイズ：空白で区切った非空白トークン列（位置は locateTokens が左から走査）。
function defaultTokenize(text) {
  return text.match(/\S+/g) || []
}

// 各トークンを text 上で左から順に探し、[start,end)（end 排他）を割り当てる。
// 重複語も cursor を進めながら探すので index 基準で正しい位置になる。
function locateTokens(text, tokens) {
  const ranges = []
  let cursor = 0
  for (const tok of tokens) {
    const idx = typeof tok === 'string' ? text.indexOf(tok, cursor) : -1
    if (idx < 0) {
      ranges.push(null)
      continue
    }
    ranges.push({ start: idx, end: idx + tok.length })
    cursor = idx + tok.length
  }
  return ranges
}

// 伏字トークンの index 群から、text の char レンジ [{start,end}]（end 排他）を返す。
// 連続 index も結合せず語ごとに1レンジ。昇順・重複除去・text 長内。非破壊。
// tokenize 未注入時は空白分割（和文など空白の無い言語は tokenize を注入して分割規則を差し替える）。
export function computeClozeMask(text, tokenIndexes, tokenize) {
  if (!tokenIndexes || tokenIndexes.length === 0) return []
  const tokens = (tokenize || defaultTokenize)(text)
  const ranges = locateTokens(text, tokens)
  const wanted = [...new Set(tokenIndexes)].sort((a, b) => a - b)
  const out = []
  for (const i of wanted) {
    const r = ranges[i]
    if (r && r.end > r.start && r.end <= text.length) out.push(r)
  }
  return out
}

// 例文/英英の「文中 1〜3 語伏字」合成（#402 Task B）。打鍵対象の英文（item.en）の内容語を
// char レンジでマスクする。pickClozeTokens（語 index 選定）と computeClozeMask（char レンジ化）を束ねる。
//   ・target = item.en（照合は従来どおり文全体を打つ＝mask は表示用メタのみ）。
//   ・tokenize は enWords を渡す（既定 \S+ だと末尾ピリオドが語に張り付き index がずれるため）。
//     enWords は末尾句読点を独立トークンにするので defaultIsContent が記号を除外＝内容語だけ選ばれる。
//   ・内容語 0 → ranges:[]（伏せない）。item 非破壊・rng 決定的。
// ja/読み側の文中マスクは分割規則が複雑なため今回は対象外（mode に依らず en を対象にする）。
export function buildClozeSentence(item, mode, { rng = Math.random, min = 1, max = 3 } = {}) {
  const target = item.en
  const tokens = enWords(target)
  const picked = pickClozeTokens(tokens, { rng, min, max })
  const ranges = computeClozeMask(target, picked, enWords)
  return { target, ranges }
}

// cloze モードでミスが出たら正体を開示する（伏字を解く）。
// cloze 以外・ミス 0 以下では常に false。
export function isClozeRevealed(learningMode, segMistakes) {
  return learningMode === 'cloze' && segMistakes > 0
}
