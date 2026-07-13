// @vitest-environment jsdom
// migrations.migration.js を Migration 契約（assertMigration）に載せるメタテスト。#335（#322 契約テストシリーズ）。
// Migration は「順序付き DDL 定義集」＝各 up(db) は db.exec で DDL（CREATE TABLE/INDEX・ALTER）を書くだけの宣言で、
// 業務ロジック（分岐・DML・計算・クロック/乱数）を持たない。かつ version 保護（runMigrations の forward-only）と
// IF NOT EXISTS により、まっさらな DB へ何度適用しても同一スキーマへ収束する（冪等）。
// ここで検証する契約は2つ：
//   (1) DDL-only（静的）… stripComments 後のソースに業務ロジックのトークンを含まない（#332 の静的 grep と同型）。
//   (2) 冪等（結合）    … in-memory sqlite に applySchema を2回適用しても最終スキーマ（テーブル/バージョン）が同一。
// (1) は個々の up 実行では踏めない未到達枝も封じたいのでファイル単位の静的 grep、(2) は sqlite backing の
// 実挙動（#329 の repository 契約と同じ生成方法＝sqlite3InitModule → new sqlite3.oo1.DB()）で担保する。
// ファイル名は .contract.test.js ＝命名メタテスト（.migration.js 強制）の対象外。
import { describe, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { assertMigration } from '../../test/contracts/migration.js'
import { applySchema } from './applySchema.schema.js'
import { runMigrations } from './runMigrations.adapter.js'

// このテストからの相対パスでソース文字列を読む（先例 policy.contract.test.js の read）。
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// sqlite3 は beforeAll 後にのみ存在＝it() 実行時（makeDb 呼び出し時）に遅延生成する（#329 repos の freshDb と同流儀）。
let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})
const freshDb = () => new sqlite3.oo1.DB()

// ───────────────────────────────────────────────────────────
// migrations.migration.js（本 Issue の対象モジュール）
//   source … DDL-only 静的 grep 用のソース文字列。
//   makeDb … まっさらな in-memory sqlite。apply … migrations を適用する公開入口（applySchema＝runMigrations 経由）。
//   applySchema は version 保護つきなので2回目は no-op＝ALTER も再実行されない（冪等の要）。
// ───────────────────────────────────────────────────────────
describe('Migration契約: migrations.migration.js', () =>
  assertMigration({
    source: read('./migrations.migration.js'),
    makeDb: freshDb,
    apply: (db) => applySchema(db),
  }))

// ───────────────────────────────────────────────────────────
// ヘルパ自己テスト：準拠するダミー migrations を通す（policy/adapter 契約末尾の流儀）。
//   ダミーは DDL-only（CREATE IF NOT EXISTS ＋ ALTER）で、version 保護つき runMigrations 経由なら2回適用しても
//   ALTER が再実行されず冪等に収束する＝(2) が緑にできることを示す。source はコメント＋空配列のみ＝(1) も緑。
// ───────────────────────────────────────────────────────────
const dummy = [
  { version: 1, up: (db) => db.exec('CREATE TABLE IF NOT EXISTS t(id INTEGER PRIMARY KEY)') },
  { version: 2, up: (db) => db.exec('ALTER TABLE t ADD COLUMN name TEXT') },
]
describe('Migration契約ヘルパ自己テスト: 準拠するダミー migrations を通す', () =>
  assertMigration({
    source: 'export const migrations = []\n',
    makeDb: freshDb,
    apply: (db) => runMigrations(db, dummy),
  }))
