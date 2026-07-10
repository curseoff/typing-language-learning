// 版付きマイグレーションランナー（PRAGMA user_version 基準・前方のみ・各Tx適用）。
// OPFS/Worker には依存しない純ロジック（db 抽象＝selectValue/transaction/exec の3メソッドを受け取る）。
// - 現在版は selectValue('PRAGMA user_version') で取得（number）。
// - migrations のうち version > 現在版のみを昇順適用（forward-only）。
// - 各マイグレーションは up と PRAGMA user_version=N を同一 transaction で実行し、
//   up の throw はそのまま伝播（transaction 側が ROLLBACK・再throw）＝以降は試行しない。
// - 返り値は適用後の最終版数（適用なしなら現在版）。
export function runMigrations(db, migrations) {
  let current = Number(db.selectValue('PRAGMA user_version')) || 0
  // 前方のみ・昇順に整列（入力が順不同でも安全）。
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version)

  for (const m of pending) {
    // up の DDL と版設定を1トランザクションで包む（原子性）。up の throw は伝播し中断。
    db.transaction((tx) => {
      m.up(tx)
      tx.exec(`PRAGMA user_version = ${m.version}`)
    })
    current = m.version
  }

  return current
}
