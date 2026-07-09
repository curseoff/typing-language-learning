// @vitest-environment jsdom
// #267 [#264 Phase4] 耐久＝export/import(.sqlite3) の純関数（Red）。
// 対象（coder が後で実装する未実装 API）:
//   src/application/backup.js →
//     looksLikeSqlite(bytes)      … 先頭16バイトが SQLite マジックか（入口ガード）
//     buildBackupFilename(date)   … typing-language-learning-YYYYMMDD-HHmmss.sqlite3（ゼロ埋め）
//     isValidUserDb(db)           … 取り込んだ DB が本アプリのユーザーDBとして妥当か
//                                   （user_version>=2 かつ 期待テーブルが sqlite_master に全て在る）
// 実インメモリ sqlite-wasm ＋ Phase2 の applySchema を使い、実バイト/実 DB で検証する。
import { describe, it, expect, beforeAll } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../infrastructure/db/schema.js'
import { looksLikeSqlite, buildBackupFilename, isValidUserDb } from './backup.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

// applySchema 済み DB を作る（都度まっさら）。
function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

// 実 DB を .sqlite3 相当のバイト列（先頭に SQLite マジックを含む）に書き出す。
function realSqliteBytes() {
  const db = freshDb()
  const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer)
  db.close()
  return bytes
}

// "SQLite format 3\0" の16バイト。
const MAGIC = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]

describe('#267 application/backup: looksLikeSqlite（先頭16バイトのマジック判定）', () => {
  it('実 DB を書き出したバイト列（先頭が SQLite マジック）を true と判定する', () => {
    const bytes = realSqliteBytes()
    expect(looksLikeSqlite(bytes)).toBe(true)
  })

  it('マジック16バイト＋ダミーを続けたバイト列も true と判定する', () => {
    const bytes = new Uint8Array([...MAGIC, 0, 1, 2, 3, 4, 5])
    expect(looksLikeSqlite(bytes)).toBe(true)
  })

  it('マジックが1バイトでも異なれば false（別形式のファイル）', () => {
    const bad = new Uint8Array([...MAGIC])
    bad[0] = 0x00 // 先頭を壊す
    expect(looksLikeSqlite(bad)).toBe(false)
  })

  it('16バイト未満（短すぎる）バイト列は false', () => {
    expect(looksLikeSqlite(new Uint8Array(MAGIC.slice(0, 8)))).toBe(false)
  })

  it('空バイト列は false', () => {
    expect(looksLikeSqlite(new Uint8Array(0))).toBe(false)
  })

  it('null は false（未選択・読み込み失敗の入口ガード）', () => {
    expect(looksLikeSqlite(null)).toBe(false)
  })
})

describe('#267 application/backup: buildBackupFilename（固定 date → 決定的なファイル名）', () => {
  it('typing-language-learning-YYYYMMDD-HHmmss.sqlite3 の形で組み立てる', () => {
    // 2026-07-09 09:22:10（月=6 は 0 始まり＝7月）
    const date = new Date(2026, 6, 9, 9, 22, 10)
    expect(buildBackupFilename(date)).toBe('typing-language-learning-20260709-092210.sqlite3')
  })

  it('月/日/時/分/秒を2桁ゼロ埋めする（1桁の値でも桁落ちしない）', () => {
    // 2026-01-03 04:05:06 → 20260103-040506
    const date = new Date(2026, 0, 3, 4, 5, 6)
    expect(buildBackupFilename(date)).toBe('typing-language-learning-20260103-040506.sqlite3')
  })
})

describe('#267 application/backup: isValidUserDb（本アプリのユーザーDBか判定）', () => {
  it('applySchema 済み DB（user_version=2・全テーブル在り）は true', () => {
    const db = freshDb()
    expect(isValidUserDb(db)).toBe(true)
    db.close()
  })

  it('空 DB（テーブル無し・user_version=0）は false', () => {
    const db = new sqlite3.oo1.DB()
    expect(isValidUserDb(db)).toBe(false)
    db.close()
  })

  it('一部テーブルだけ作った DB（期待テーブルが欠ける）は false', () => {
    // user_version は 2 に立てるが、期待テーブルの一部（meta）を落として「欠け」を作る。
    const db = freshDb()
    db.exec('DROP TABLE "meta"')
    expect(isValidUserDb(db)).toBe(false)
    db.close()
  })

  it('全テーブルは在るが user_version が 2 未満（古い版）なら false', () => {
    const db = freshDb()
    db.exec('PRAGMA user_version = 1')
    expect(isValidUserDb(db)).toBe(false)
    db.close()
  })
})
