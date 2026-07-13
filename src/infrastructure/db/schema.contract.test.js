// @vitest-environment jsdom
// スキーマ適用ファサード（.schema.js＝applySchema）を共通契約（assertSchema）に載せるメタテスト。#336
// （#322 契約テストシリーズ・#334 Adapter 契約 / #329 Repository 契約と対になる）。
// Schema（.schema.js）は「migration 群を DB へ適用する薄い入口」。ここで検証するのは2契約：
//   (1) 適用ファサード … DDL 本体（CREATE TABLE / ALTER TABLE / CREATE INDEX）を自分では持たず、
//       migration へ委譲する薄いラッパである（DDL 定義は migration の責務＝ファサードに漏らさない）。
//   (2) 冪等 … 空の in-memory SQLite へ apply すると期待テーブル群と最終 user_version が存在し、
//       同じ db へ再 apply しても（前方のみ＝forward-only なので）テーブル/バージョンは不変。
//
// backing 依存の実挙動（OPFS/Worker）は pwa-verifier 領分＝ここでは扱わない。sqlite backing の
// round-trip は Repository 契約（repos/repository.contract.test.js）が担い、本ファイルは「土台を敷く
// 入口そのもの」を対象にする（sqlite3-wasm の in-memory DB へ直接 apply して観測する）。
//
// ファイル名は .contract.test.js ＝命名メタテスト（.schema.js 強制）の対象外。
import { describe, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { assertSchema } from '../../test/contracts/schema.js'
import { applySchema } from './applySchema.schema.js'
import { migrations } from './migrations.migration.js'

// このテストからの相対パスでファサードのソース文字列を読む（先例 policy.contract.test.js / _ddd-naming.test.js）。
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

// 空の in-memory DB を毎回新規に返す（applySchema をまだ通していない＝まっさら）。
// sqlite3 は beforeAll 後にのみ存在するので、it() 内で遅延生成される newDb として渡す。
const newDb = () => new sqlite3.oo1.DB()

// 独立オラクル（ファサードを再呼びせず sqlite の生 API で観測する）。
const tableExists = (db, name) =>
  db.selectValue(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='${name}'`) != null
const userVersion = (db) => Number(db.selectValue('PRAGMA user_version')) || 0

// 期待テーブル群（migration が敷く土台の正本＝この集合の存在を契約する）。
const EXPECTED_TABLES = [
  'meta',
  'records',
  'word_records',
  'dict_records',
  'item_stats',
  'story_endings',
  'story_records',
]
// 期待バージョンは migration 定義の最大版から導く（版追加でテストが脆くならないよう再エンコードしない）。
const EXPECTED_VERSION = Math.max(...migrations.map((m) => m.version))

describe('Schema契約: applySchema.schema.js（適用ファサード・sqlite backing）', () =>
  assertSchema({
    apply: (db) => applySchema(db),
    source: read('./applySchema.schema.js'),
    newDb,
    tableExists,
    userVersion,
    tables: EXPECTED_TABLES,
    version: EXPECTED_VERSION,
  }))

// ───────────────────────────────────────────────────────────
// ヘルパ自己テスト：assertSchema が「準拠するダミー schema」を通す
//   （前方のみで冪等・DDL 本体を持たないファサード＝2契約をすべて緑にできることを示す）。
//   adapter.contract.test.js / policy.contract.test.js 末尾の流儀に倣う。
//   fake db は素の JS（tables Set + version）で backing 非依存に冪等を再現する。
// ───────────────────────────────────────────────────────────
const fakeApply = (db) => {
  for (const t of ['meta', 'records']) db.tables.add(t) // IF NOT EXISTS 相当＝Set 追加は冪等
  if (db.version < 2) db.version = 2 // forward-only（既に上なら据え置き）
  return db.version
}
describe('Schema契約ヘルパ自己テスト: 準拠するダミー schema を通す', () =>
  assertSchema({
    apply: fakeApply,
    source: '// migration へ委譲する薄いラッパ（DDL は持たない）\nexport const applyFake = (db) => db\n',
    newDb: () => ({ tables: new Set(), version: 0 }),
    tableExists: (db, name) => db.tables.has(name),
    userVersion: (db) => db.version,
    tables: ['meta', 'records'],
    version: 2,
  }))
