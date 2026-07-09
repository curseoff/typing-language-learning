// #268 [#264 Phase5a] 起動時 integrity_check→内部バックアップから自動復元の判断ロジック（純関数）。
// すべて DOM/infra 非依存・副作用なし・入力非破壊。Worker/起動フロー（配線）はここを呼ぶだけにして、
// 「健全/破損の判定」「チェックサム」「世代ローテ」「復元候補選定」の判断をここに閉じ込める
// （依存方向：infra/UI → application。判断ロジックは計測対象＝recovery.test.js で被覆）。

// integrity_check（or quick_check）の結果→健全/破損の純判定。
// 健全は「文字列 'ok'（前後空白は trim して許容）」または「単一要素配列 ['ok']（要素も trim）」のみ。
// 複数行の配列・他文言・空・null/undefined は破損(false)。常に boolean を返す。
export function evaluateIntegrity(pragmaResult) {
  if (typeof pragmaResult === 'string') {
    return pragmaResult.trim() === 'ok'
  }
  if (Array.isArray(pragmaResult)) {
    return pragmaResult.length === 1 && typeof pragmaResult[0] === 'string' && pragmaResult[0].trim() === 'ok'
  }
  return false
}

// バイト列→決定的な16進チェックサム（FNV-1a 32bit・純関数・入力非破壊）。
// 同一バイト列→同値／差分・順序・長さで別値／空でも定義値。小文字16進8桁で返す。
// バックアップの版数照合や健全性の副次判定に使う（暗号強度は不要＝改ざん検知用途ではない）。
export function computeChecksum(bytes) {
  let hash = 0x811c9dc5 // FNV offset basis (32bit)
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    // FNV prime 16777619 を 32bit で掛ける（オーバーフロー回避のため分割乗算）。
    hash = Math.imul(hash, 0x01000193)
  }
  // 符号なし32bitへ丸めてゼロ埋め8桁の小文字16進に。
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// 内部バックアップの N 世代ローテ（純関数・入力非破壊）。
// createdAt 降順の安定ソートで先頭 maxGen 件を keep（新しい順で返す）・残りを remove。
// 同 createdAt の tie は入力順を保つ（安定）。件数≤maxGen なら remove は空。
export function rotateBackups(backups, maxGen) {
  // 元配列を壊さないよう複製してから安定ソート（Array#sort は安定・comparator 0 で入力順維持）。
  const sorted = backups.slice().sort((a, b) => b.createdAt - a.createdAt)
  return {
    keep: sorted.slice(0, maxGen),
    remove: sorted.slice(maxGen),
  }
}

// 復元候補＝直近の健全バックアップを選ぶ（純関数・入力非破壊）。
// healthy: true の中で createdAt 最新を返す（新しい破損はスキップ）。健全が皆無/空なら null。
export function selectRestoreCandidate(backups) {
  let best = null
  for (const b of backups) {
    if (!b || !b.healthy) continue
    if (best === null || b.createdAt > best.createdAt) best = b
  }
  return best
}
