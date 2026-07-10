// スキーマ適用の薄いラッパ。migrations を version 昇順に前方適用して全テーブルを用意する。
// テスト・Phase3 の配線からはこの1関数だけを呼べばよい（runMigrations/migrations の存在を隠す）。
import { runMigrations } from './runMigrations.adapter.js'
import { migrations } from './migrations.migration.js'

export function applySchema(db) {
  return runMigrations(db, migrations)
}
