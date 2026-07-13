import { it, expect } from 'vitest'

// Migration（infrastructure の .migration.js＝順序付き DDL 定義集）の契約テスト用の再利用ヘルパ。#335（#322 契約テストシリーズ）。
// Migration は「version 昇順・forward-only の DDL 定義集」＝各 up(db) は db.exec で DDL（CREATE TABLE/INDEX・ALTER）を
// 書くだけの宣言で、業務ロジック（DML・分岐・計算・クロック/乱数）を持たない。version 保護（runMigrations の
// forward-only）と IF NOT EXISTS により、まっさらな DB へ何度適用しても同一スキーマへ収束する（冪等）。
//
// 契約は2つ：
//   (A) DDL-only（静的） … stripComments 後のソースに業務ロジックのトークンを含まない（#332 の静的 grep と同型）。
//                          個々の up 実行では踏めない未到達枝も封じたいのでファイル単位の静的 grep で担保する。
//   (B) 冪等（結合）     … in-memory sqlite へ apply を2回適用しても最終スキーマ（テーブル/バージョン）が同一。
//                          version 保護つきなので2回目は no-op＝ALTER も再実行されない。
// #323 VO・#324 Entity・#329 Repository・#332 Policy・#334 Adapter 契約と同じ流儀。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数：
//   source … string    当該 .migration.js のソース文字列（(A) の静的 grep 用）。
//   makeDb … () => db   毎回まっさらな in-memory sqlite（selectObjects/selectValue を持つ oo1.DB）。
//   apply  … (db) => *  migrations を適用する公開入口（applySchema＝runMigrations 経由）。

// 静的 grep で禁じる業務ロジックのトークン（Migration は DDL 宣言のみ＝いずれも現れてはならない）。
//   DML/クエリ（insert/update/delete/select）・分岐/ループ（if/for/while/switch）・計算/クロック/乱数（Math./Date.now/new Date/random）。
//   Date は全面禁止しない："date" 列名は DDL に現れるため Date.now と引数なし new Date() のみ禁止（policy 契約と同流儀）。
const DEFAULT_FORBIDDEN = [
  /\binsert\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bselect\b/i,
  /\bif\s*\(/,
  /\bfor\s*\(/,
  /\bwhile\s*\(/,
  /\bswitch\s*\(/,
  /\bMath\./,
  /\bDate\.now\b/,
  /new Date\s*\(/,
  /\brandom\b/i,
]

// 行コメント（//…）とブロックコメント（/*…*/）を除去する（コメント内トークンの誤検知回避）。policy 契約と同一。
// http:// のような「: の直後の //」は URL とみなしてコメント扱いしない（行内コメントは直前が非 : のときのみ）。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // ブロックコメント
    .replace(/([^:]|^)\/\/.*$/gm, '$1') // 行コメント（行頭 or 直前が非 : のときだけ）
}

// スキーマの観測像（テーブル/インデックスの定義とバージョン）。sqlite 内部オブジェクト（sqlite_%）は除く。
function schemaSnapshot(db) {
  return {
    objects: db.selectObjects(
      "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
    ),
    version: Number(db.selectValue('PRAGMA user_version')) || 0,
  }
}

export function assertMigration({ source, makeDb, apply, forbidden = DEFAULT_FORBIDDEN }) {
  it('DDL 宣言のみ：業務ロジック（DML/分岐/計算/クロック/乱数）を含まない（静的）', () => {
    const code = stripComments(source)
    const hits = forbidden.filter((re) => re.test(code)).map(String)
    expect(hits).toEqual([])
  })

  it('冪等：同じ DB へ2回 apply しても最終スキーマ（テーブル/バージョン）が同一', () => {
    const db = makeDb()
    apply(db)
    const first = schemaSnapshot(db)
    expect(first.objects.some((o) => o.type === 'table')).toBe(true) // 空適用でないこと（vacuous 防止）
    apply(db)
    const second = schemaSnapshot(db)
    expect(second).toEqual(first)
  })
}
