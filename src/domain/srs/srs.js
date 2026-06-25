// 間隔反復（SRS, Leitner方式）のスケジューリング。React/DOM 非依存の純ロジック。
// カード: { box, due, reps, lapses }。box は 0(新規)〜MAX_BOX。due は「日番号」(エポックからの日数)。
// 正解で box を上げ間隔を延ばす／不正解で box1・当日に戻す。

// box → 次回までの日数。box0 は即日(=新規でまだ学習していない)。
export const INTERVALS = [0, 1, 3, 7, 16, 35, 90]
export const MAX_BOX = INTERVALS.length - 1

export function newCard() {
  return { box: 0, due: 0, reps: 0, lapses: 0 }
}

// 復習結果を反映した新カードを返す（純関数）。today は日番号。
export function review(card, ok, today) {
  const c = card || newCard()
  if (ok) {
    const box = Math.min(c.box + 1, MAX_BOX)
    return { box, due: today + INTERVALS[box], reps: c.reps + 1, lapses: c.lapses }
  }
  // ミス: box1 に戻し当日に再出題、lapses を加算
  return { box: 1, due: today, reps: c.reps + 1, lapses: c.lapses + 1 }
}

// 期限到来（未学習カード=srs無し も due 扱い）
export function isDue(card, today) {
  return !card || card.due <= today
}

// 出題キューを作る。
// ids: 候補(頻度順など)の id 配列 / srs: { id: card } / today: 日番号
// 返り値: { reviews:[期限到来の既習id], news:[新規id（newLimitまで）] }
export function buildQueue(ids, srs, today, { newLimit = 10, reviewLimit = 60 } = {}) {
  const reviews = []
  const news = []
  for (const id of ids) {
    const card = srs[id]
    if (card) {
      if (card.due <= today && reviews.length < reviewLimit) reviews.push(id)
    } else if (news.length < newLimit) {
      news.push(id)
    }
  }
  return { reviews, news }
}

// --- 穴埋め(クローズ)ヒント：習熟(box)が上がるほど伏せ字を増やす ---
// 文字列ハッシュ→32bit PRNG。seed(カードid)で決定的にし、描画ごとに伏せ位置がブレないようにする。
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// answer の各文字を「見せるか(true)/伏せるか(false)」の配列で返す。box が高いほど伏せ字が多い。
// 頭文字は手がかりとして残す（完全習熟=MAX_BOX で全伏せ＝完全想起）。
export function clozeShown(answer, box = 0, seed = answer) {
  const len = [...answer].length
  if (len <= 1 || box >= MAX_BOX) return new Array(len).fill(box < MAX_BOX) // 完全習熟なら全伏せ
  const ratio = 0.25 + (0.75 * Math.min(box, MAX_BOX)) / MAX_BOX // 伏せる割合 0.25→1.0
  const blanks = Math.max(1, Math.min(Math.round(len * ratio), len - 1)) // 最低1・頭文字は残す
  const idx = []
  for (let i = 1; i < len; i++) idx.push(i) // 頭文字(0)以外が伏せ候補
  const rnd = mulberry32(hashStr(String(seed)))
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const blanked = new Set(idx.slice(0, blanks))
  return Array.from({ length: len }, (_, i) => !blanked.has(i))
}

// 学習状況の集計（バッジ表示用）。today は日番号。
export function summarize(ids, srs, today) {
  let learned = 0
  let due = 0
  for (const id of ids) {
    const card = srs[id]
    if (!card) continue
    learned++
    if (card.due <= today) due++
  }
  return { learned, due, total: ids.length, fresh: ids.length - learned }
}
