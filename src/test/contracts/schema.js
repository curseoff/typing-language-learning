import { it, expect } from 'vitest'

// Schema（infrastructure の .schema.js＝applySchema）の契約テスト用の再利用ヘルパ。#336（#322 契約テストシリーズ）。
// Schema は「migration 群を DB へ適用する薄い入口（適用ファサード）」＝DDL 定義そのものは持たず、
// runMigrations/migrations へ委譲して「土台のテーブル群と user_version を敷く」ことだけを担う。
// DDL 本体（CREATE TABLE / ALTER TABLE / CREATE INDEX）は migration の責務なので、ファサードに漏らさない。
//
// backing の実挙動（OPFS/Worker）は pwa-verifier の領分＝ここでは扱わない。契約は「静的＋in-memory 結合」に限定する：
//   (1) 適用ファサード … ソース文字列に DDL 本体を持たない（薄いラッパ＝定義は migration へ委譲する）。
//       未到達枝も含めて「持たない」ことを禁じたいので、実行ではなくファイル単位の静的 grep で担保する。
//   (2) 冪等 … 空 DB へ apply すると期待テーブル群と最終 user_version が揃い、同じ DB へ再 apply しても
//       （前方のみ＝forward-only なので）テーブル/バージョンは不変。
//
// #329 Repository・#330 DomainService・#332 Policy・#334 Adapter 契約と同じ流儀。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。

// DDL 本体（migration の責務）を表す静的パターン。ファサードのソースがこれらを持てば「薄いラッパ」契約違反。
const DDL_PATTERNS = [
  /\bCREATE\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i,
]

// 行コメント（//…）とブロックコメント（/*…*/）を除去する。grep 前に必ず通す（コメント内の DDL 語での誤検知回避）。
// policy.js と同じ流儀（http:// のような「: の直後の //」は URL とみなしてコメント扱いしない）。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // ブロックコメント
    .replace(/([^:]|^)\/\/.*$/gm, '$1') // 行コメント（行頭 or 直前が非 : のときだけ）
}

// 引数（すべて呼び出し側の Schema/backing に依存しない純関数で渡す・独立オラクル）：
//   apply       … (db) => version   適用ファサード。db へ全 migration を前方適用し最終版を返す。
//   source      … string            適用ファサードのソース文字列（DDL 本体を持たないことを静的検証する）。
//   newDb       … () => db           毎回まっさら（未 apply）な空 DB を返す。it() 内で遅延生成される。
//   tableExists … (db, name) => bool そのテーブルが存在するか（生 API 由来の独立オラクル）。
//   userVersion … (db) => number     現在の user_version（apply とは別経路で観測する）。
//   tables      … string[]           apply 後に存在すべきテーブル群（migration が敷く土台の正本）。
//   version     … number             apply 後の最終 user_version（migration 定義の最大版）。
export function assertSchema({ apply, source, newDb, tableExists, userVersion, tables, version }) {
  it('適用ファサード：DDL 本体を持たず migration へ委譲する（薄いラッパ・静的）', () => {
    const code = stripComments(source)
    const hits = DDL_PATTERNS.filter((re) => re.test(code)).map(String)
    expect(hits).toEqual([])
  })

  it('冪等：空 DB へ apply すると期待テーブル群と最終 user_version が揃う', () => {
    const db = newDb()
    apply(db)
    for (const t of tables) {
      expect(tableExists(db, t), `テーブル ${t} が存在するべき`).toBe(true)
    }
    expect(userVersion(db)).toBe(version)
  })

  it('冪等：同じ DB へ再 apply してもテーブル/バージョンは不変（forward-only）', () => {
    const db = newDb()
    apply(db)
    apply(db) // 2回目：前方のみなので既に最新＝適用対象なし。
    for (const t of tables) {
      expect(tableExists(db, t), `再 apply 後もテーブル ${t} が存在するべき`).toBe(true)
    }
    expect(userVersion(db)).toBe(version)
  })
}
