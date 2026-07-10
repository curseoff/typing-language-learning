// 問題別の累積統計 `id → {count, keys, mistakes, ms}` を表す Entity `ItemStat`（#314）。
// 累積ルール（count+1／各値加算）が application(memoryStore.policy.applyRecordItemStat) と
// infrastructure(itemStats.repository.recordItemStatDb の SQL upsert) に散っていたため、
// domain の Entity にルールを一本化する。
//
// Entity らしさ（VO との対比）：
//   - 同一性 id を持つ（値ではなく id で等価判定＝itemStatEquals）。
//   - 時間をまたぐ可変状態を「イミュータブル変換」で表す（recordAttempt は元を変えず新インスタンスを返す）。
//   - 自己検証（不変条件：非負整数・非負有限）を守り、凍結する。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存・副作用なし・決定的。

// count/keys/mistakes の制約：非負整数。
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// ms の制約：非負の有限数（小数許容）。
function isNonNegativeFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// ItemStat のファクトリ＋自己検証＋不変（凍結）。値は省略可・既定 0。不変条件違反は throw する。
//   id                 … 非空文字列必須（同一性の基盤）。
//   count/keys/mistakes … 非負整数（負/非整数/NaN/Infinity/非数は throw）。
//   ms                 … 非負の有限数（負/NaN/Infinity/非数は throw、小数は許容）。
export function makeItemStat({ id, count = 0, keys = 0, mistakes = 0, ms = 0 } = {}) {
  if (typeof id !== 'string' || id === '') {
    throw new Error(`makeItemStat: id は非空文字列が必要: ${String(id)}`)
  }
  for (const [field, value] of [
    ['count', count],
    ['keys', keys],
    ['mistakes', mistakes],
  ]) {
    if (!isNonNegativeInteger(value)) {
      throw new Error(`makeItemStat: ${field} は非負整数が必要: ${String(value)}`)
    }
  }
  if (!isNonNegativeFinite(ms)) {
    throw new Error(`makeItemStat: ms は非負の有限数が必要: ${String(ms)}`)
  }

  return Object.freeze({
    id,
    count,
    keys,
    mistakes,
    ms,

    // 1回分の記録を累積する（元を変えず新しい凍結 ItemStat を返す＝イミュータブル）。
    //   count は +1、keys/mistakes/ms は delta を加算する。id は不変。
    //   delta 検証：keys/mistakes 非負整数、ms 非負有限（不正 delta は throw）。
    recordAttempt({ keys: dKeys, mistakes: dMistakes, ms: dMs } = {}) {
      for (const [field, value] of [
        ['keys', dKeys],
        ['mistakes', dMistakes],
      ]) {
        if (!isNonNegativeInteger(value)) {
          throw new Error(`recordAttempt: ${field} の delta は非負整数が必要: ${String(value)}`)
        }
      }
      if (!isNonNegativeFinite(dMs)) {
        throw new Error(`recordAttempt: ms の delta は非負の有限数が必要: ${String(dMs)}`)
      }
      return makeItemStat({
        id,
        count: count + 1,
        keys: keys + dKeys,
        mistakes: mistakes + dMistakes,
        ms: ms + dMs,
      })
    },
  })
}

// 型ガード（throw しない）。x がオブジェクトで id 非空文字列・count/keys/mistakes 非負整数・
// ms 非負有限なら true。null/非オブジェクト/不正値は false（makeItemStat 経由でなくても妥当なら true）。
export function isItemStat(x) {
  if (x == null || typeof x !== 'object') return false
  const { id, count, keys, mistakes, ms } = x
  if (typeof id !== 'string' || id === '') return false
  if (
    !isNonNegativeInteger(count) ||
    !isNonNegativeInteger(keys) ||
    !isNonNegativeInteger(mistakes)
  ) {
    return false
  }
  return isNonNegativeFinite(ms)
}

// 同一性（ID）による等価判定（throw しない・boolean）。
// VO の値等価と対照：count 等の値が違っても id が一致すれば同じ実体＝true。
// 両者が妥当な ItemStat（id を持つ）で id が一致すれば true。null/不正は false。
export function itemStatEquals(a, b) {
  if (!isItemStat(a) || !isItemStat(b)) return false
  return a.id === b.id
}
