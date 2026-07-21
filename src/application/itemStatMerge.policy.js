// #450 対戦の学習統計を通常プレイと区別する（「分けて持ち、合算で見せる」の合算側）。
// item-stats は通常プレイ id と対戦 id に分かれて積まれるので、収録一覧などの表示側は
// 両方を引いて足す必要がある。その足し算だけを担う純関数。

const FIELDS = ['count', 'keys', 'mistakes', 'ms']

// 実体（記録あり）とみなすのはオブジェクトだけ。null や数値・文字列は記録なし扱いにして落とす
// （呼び出し側がマップの getter からそのまま渡しても壊れないよう全域にしておく）。
const isStat = (s) => s != null && typeof s === 'object'

// 通常＋対戦（将来さらに増えてもよい）の item-stat を可変個で合算する。非破壊・全域。
// 全部が記録なしなら undefined を返す：表示側（ItemList）は undefined を「何も表示しない」
// として扱うため、ここで {count:0,...} を返すと未挑戦の問題に 0 がずらりと並ぶ表示回帰になる。
export function sumItemStats(...stats) {
  const present = stats.filter(isStat)
  if (present.length === 0) return undefined
  const out = {}
  // 欠けている項目は 0 として足す（片方に ms が無い等）。返り値は4項目だけを持つ新オブジェクト。
  for (const field of FIELDS) {
    out[field] = present.reduce((sum, s) => sum + (s[field] || 0), 0)
  }
  return out
}
