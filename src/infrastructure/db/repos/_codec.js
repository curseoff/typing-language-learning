// DB リポジトリ共通のコーデック（列⇄record 変換の純ヘルパ）。
// localStorage リポジトリと同値な round-trip を保つための「NULL 列＝プロパティ省略」規約を集約する。
// SQLite は NULL を JS の null で返すので、null/undefined を等しく「不在」とみなす（!= null）。

// 値が存在するとき（null/undefined でない）だけプロパティを立てる。
// 0 や '' は有効値として保持する（!= null は 0/'' を通す）。
export function assign(obj, key, val) {
  if (val != null) obj[key] = val
}

// record.endCondition を列（ec_kind/ec_value）へ。無ければ両方 null（＝省略復元）。
// endless のように value を持たない終了条件は ec_value=null（正規化しない＝生の形を保つ）。
export function ecToColumns(endCondition) {
  if (endCondition == null) return { ec_kind: null, ec_value: null }
  return { ec_kind: endCondition.kind ?? null, ec_value: endCondition.value ?? null }
}

// ec_kind/ec_value 列から endCondition を復元。ec_kind が NULL なら endCondition 自体を省略（undefined）。
// value が NULL の種別（endless 等）は value キーを作らない（{kind} のまま）。
export function ecFromRow(row) {
  if (row.ec_kind == null) return undefined
  const ec = { kind: row.ec_kind }
  if (row.ec_value != null) ec.value = row.ec_value
  return ec
}

// JSON 列を stringify（不在は null 列に）。
export function jsonToColumn(val) {
  return val != null ? JSON.stringify(val) : null
}

// JSON 列を parse（NULL は undefined＝プロパティ省略のシグナル）。
export function jsonFromColumn(text) {
  return text != null ? JSON.parse(text) : undefined
}
