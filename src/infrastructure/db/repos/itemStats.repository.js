// 問題ごとの累積記録の DB リポジトリ（現行 itemStatsRepository と同値）。
// id='type:mode:key'。key は文中コロンを含みうるので分解は先頭2つの ':' のみ（id 原文は PK として温存）。
// 積算は upsert（ON CONFLICT DO UPDATE で count+1・keys/mistakes/ms を合算）。

// 先頭2つの ':' で type/mode/item_key に割る（3つ目以降の ':' は item_key に残す）。
function splitId(id) {
  const c1 = id.indexOf(':')
  const c2 = id.indexOf(':', c1 + 1)
  return { type: id.slice(0, c1), mode: id.slice(c1 + 1, c2), item_key: id.slice(c2 + 1) }
}

export function recordItemStatDb(db, id, { keys, mistakes, ms }) {
  const { type, mode, item_key } = splitId(id)
  db.exec({
    sql:
      'INSERT INTO "item_stats" ("id","type","mode","item_key","count","keys","mistakes","ms") ' +
      'VALUES (?,?,?,?,1,?,?,?) ' +
      'ON CONFLICT("id") DO UPDATE SET ' +
      '"count"="count"+1, "keys"="keys"+excluded."keys", ' +
      '"mistakes"="mistakes"+excluded."mistakes", "ms"="ms"+excluded."ms"',
    bind: [id, type, mode, item_key, keys, mistakes, ms],
  })
  return loadItemStatsDb(db)
}

// id→{count,keys,mistakes,ms} のマップ（id は原文をキーに）。
export function loadItemStatsDb(db) {
  const rows = db.selectObjects('SELECT "id","count","keys","mistakes","ms" FROM "item_stats"')
  const out = {}
  for (const row of rows) {
    out[row.id] = { count: row.count, keys: row.keys, mistakes: row.mistakes, ms: row.ms }
  }
  return out
}
