// #432 P2P穴埋め対戦：サドンデス（ライフ制）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。

// missedItems 個ミスした後の残りライフ。0 で下げ止まり（負にならない）。
export function livesFor(missedItems, initialLives) {
  return Math.max(0, initialLives - missedItems)
}

// progressMap={ [peerId]: { lives } } のうち lives<=0 の peer が居れば true。
// lives が数値でない／欠落の peer は未脱落扱いで無視。空 map は false。
export function anyoneEliminated(progressMap) {
  return Object.values(progressMap).some(
    (p) => typeof p.lives === 'number' && p.lives <= 0,
  )
}

// #443 サドンデス（ライフ制）の勝敗判定。
// players=[{ id, lives, correct }, ...]（active な全参加者・自分含む）。
//   won  : ある P が「他の全員が脱落（lives<=0）」かつ「P.correct が他の全員より strict >」
//          → { status:'won', winnerId }。P 自身は生存/脱落どちらでも可・他プレイヤー1人以上必須。
//   draw : 生存者0（全員 lives<=0）かつ 最多 correct が2人以上で並ぶ → { status:'draw' }
//   ongoing: それ以外 → { status:'ongoing' }
// 脱落順序に非依存のスナップショット判定。入力非破壊・決定的な純粋関数。
export function suddenDeathOutcome(players) {
  // 他プレイヤーが1人以上必要（N=1・空配列で vacuous win を作らない）。
  if (!Array.isArray(players) || players.length < 2) return { status: 'ongoing' }
  const maxCorrect = Math.max(...players.map((p) => p.correct))
  const leaders = players.filter((p) => p.correct === maxCorrect)
  // 唯一の strict 最大なら、他の全員が脱落していれば勝ち。
  if (leaders.length === 1) {
    const winner = leaders[0]
    const othersEliminated = players.every(
      (p) => p.id === winner.id || p.lives <= 0,
    )
    if (othersEliminated) return { status: 'won', winnerId: winner.id }
    return { status: 'ongoing' }
  }
  // 最多 correct が並ぶ：全員脱落なら引き分け、生存者が居れば継続。
  const allEliminated = players.every((p) => p.lives <= 0)
  if (allEliminated) return { status: 'draw' }
  return { status: 'ongoing' }
}
