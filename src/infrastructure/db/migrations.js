// 順序付きマイグレーション定義（version 昇順・forward-only）。
// runMigrations が version > 現在版のみを昇順適用する。各 up(db) は db.exec で DDL を書く。
//
// Phase1（本 Issue #270）は最小土台のみ：version 1 で meta テーブルを作る
// （後続 Phase で checksum / バックアップメタ等を key-value で載せる土台）。
// ユーザーデータ本体テーブル（records/dict/word/item_stats/story）はここに入れない。
// 実テーブルは Phase2（#265）で version 2 として追記予定（前方のみ＝既存 version 1 は不変）。
export const migrations = [
  {
    version: 1,
    up(db) {
      db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)')
    },
  },
]
