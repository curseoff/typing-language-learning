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
