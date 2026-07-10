// 進捗（Progress）の Value Object（不変・自己検証・イミュータブル変換・値等価）。#311 スライス。
// これまで {keys, mistakes, items, missedItems, elapsedMs} という生リテラルが層をまたいで流れ、
// 不変条件（非負整数・elapsedMs 非負有限・missedItems<=items）が誰にも守られていなかった。
// endCondition.vo.js の shouldFinish/progressRatio が p.keys/p.elapsedMs 等を直読みするため、
// これらの項目はそのまま公開して形状互換を保つ。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存・副作用なし・決定的。

// カウンタ（keys/mistakes/items/missedItems）の制約：非負整数。
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// elapsedMs の制約：非負の有限数（小数許容）。
function isNonNegativeFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// Progress のファクトリ＋自己検証＋不変（凍結）。各項目は省略可・既定 0。不変条件違反は throw する。
//   keys/mistakes/items/missedItems … 非負整数（負/非整数/NaN/Infinity/非数は throw）。
//   elapsedMs … 非負の有限数（負/NaN/Infinity/非数は throw、小数は許容）。
//   不変条件 missedItems <= items（境界の == は妥当、超過は throw）。
export function makeProgress(init = {}) {
  const { keys = 0, mistakes = 0, items = 0, missedItems = 0, elapsedMs = 0 } = init

  for (const [field, value] of [
    ['keys', keys],
    ['mistakes', mistakes],
    ['items', items],
    ['missedItems', missedItems],
  ]) {
    if (!isNonNegativeInteger(value)) {
      throw new Error(`makeProgress: ${field} は非負整数が必要: ${String(value)}`)
    }
  }
  if (!isNonNegativeFinite(elapsedMs)) {
    throw new Error(`makeProgress: elapsedMs は非負の有限数が必要: ${String(elapsedMs)}`)
  }
  if (missedItems > items) {
    throw new Error(
      `makeProgress: 不変条件 missedItems<=items に違反: missedItems=${missedItems}, items=${items}`,
    )
  }

  return Object.freeze({
    keys,
    mistakes,
    items,
    missedItems,
    elapsedMs,

    // 打鍵成功（keys+1）。元を変えず新しい凍結 Progress を返す。
    withHit() {
      return makeProgress({ keys: keys + 1, mistakes, items, missedItems, elapsedMs })
    },

    // 打鍵ミス（mistakes+1）。元を変えず新しい凍結 Progress を返す。
    withMiss() {
      return makeProgress({ keys, mistakes: mistakes + 1, items, missedItems, elapsedMs })
    },

    // 問題消化（items+1）。missed が真ならミス問題（missedItems+1）も加算する。
    withItem(missed = false) {
      return makeProgress({
        keys,
        mistakes,
        items: items + 1,
        missedItems: missed ? missedItems + 1 : missedItems,
        elapsedMs,
      })
    },

    // 経過時間を ms に置き換える（ms は elapsedMs 規則で検証・不正は throw）。
    withElapsed(ms) {
      return makeProgress({ keys, mistakes, items, missedItems, elapsedMs: ms })
    },
  })
}

// 型ガード（throw しない）。x がオブジェクトで全項目が妥当・不変条件を満たせば true。
// null/非オブジェクト/不正値/missedItems>items は false。
export function isProgress(x) {
  if (x == null || typeof x !== 'object') return false
  const { keys, mistakes, items, missedItems, elapsedMs } = x
  if (
    !isNonNegativeInteger(keys) ||
    !isNonNegativeInteger(mistakes) ||
    !isNonNegativeInteger(items) ||
    !isNonNegativeInteger(missedItems)
  ) {
    return false
  }
  if (!isNonNegativeFinite(elapsedMs)) return false
  return missedItems <= items
}

// 値等価（throw しない）。両者が妥当な Progress で 5 項目が厳密一致すれば true。
// 相違/不正/null は false。
export function progressEquals(a, b) {
  if (!isProgress(a) || !isProgress(b)) return false
  return (
    a.keys === b.keys &&
    a.mistakes === b.mistakes &&
    a.items === b.items &&
    a.missedItems === b.missedItems &&
    a.elapsedMs === b.elapsedMs
  )
}
