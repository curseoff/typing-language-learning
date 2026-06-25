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
