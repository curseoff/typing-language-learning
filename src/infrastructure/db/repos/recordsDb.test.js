// @vitest-environment jsdom
// #265 Phase2: マラソン記録の SQLite 関係スキーマ写像＋round-trip（Red）。
// 検証オラクル＝「現行 localStorage 実装と同値」。
// 同じ入力を現行 saveRecord と新 saveRecordDb に同順で流し、load 結果が deepEqual であることを主軸にする。
// 加えて壊れやすい点（undefined 省略・endCondition 再生成・上位15キャップ）は個別アサーションも置く。
//
// 対象（coder が後で実装する未実装 API）:
//   src/infrastructure/db/applySchema.schema.js        → applySchema(db)
//   src/infrastructure/db/repos/records.repository.js → saveRecordDb(db, record) / loadRecordsDb(db)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../applySchema.schema.js'
import { saveRecordDb, loadRecordsDb } from './records.repository.js'
import { recKey, MAX_RECORDS, compareRecords } from '../../../domain/records/ranking.service.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

// 都度まっさらなインメモリ DB にスキーマを適用して返す。
function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

// 実フィールドを持つ代表的なマラソン記録（segStats は record に無い＝records 表に seg_stats 不要）。
function marathon(overrides = {}) {
  return {
    mode: 'both',
    rank: 1,
    source: 'sentence',
    seed: 12345,
    endCondition: { kind: 'time', value: 60 },
    speed: 250,
    keys: 120,
    mistakes: 3,
    accuracy: 0.97,
    correctCount: 5,
    seconds: 60,
    date: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('#265 infrastructure/db/repos/recordsDb（現行 localStorage 実装と同値）', () => {
  let db
  beforeEach(() => {
    db = freshDb()
  })

  it('複数キー（source/theme/endCondition 別）の一連の記録を仕様どおり round-trip する', () => {
    const records = [
      marathon({ keys: 120, mistakes: 3 }),
      marathon({ keys: 200, mistakes: 1 }),
      // テーマ別（単語例文＝wsent）
      marathon({ mode: 'q', source: 'wsent', theme: '旅行', keys: 90 }),
      // 終了条件別（30秒制）
      marathon({ endCondition: { kind: 'time', value: 30 }, keys: 40, seconds: 30 }),
      // endless（速度順の別ランキング）
      marathon({ endCondition: { kind: 'endless' }, speed: 300, keys: 500 }),
    ]
    for (const r of records) saveRecordDb(db, r)
    // 期待値は現行 localStorage 実装が生む最終像を明示リテラル化（キー分割・keys 降順を保持）。
    expect(loadRecordsDb(db)).toEqual({
      both__r1: [marathon({ keys: 200, mistakes: 1 }), marathon({ keys: 120, mistakes: 3 })],
      'q__wsent1__旅行': [marathon({ mode: 'q', source: 'wsent', theme: '旅行', keys: 90 })],
      both__r1__T30: [
        marathon({ endCondition: { kind: 'time', value: 30 }, keys: 40, seconds: 30 }),
      ],
      both__r1__E: [marathon({ endCondition: { kind: 'endless' }, speed: 300, keys: 500 })],
    })
  })

  it('theme 無しの記録は復元後に theme プロパティが「存在しない」（null ではない）', () => {
    const r = marathon() // theme を渡さない
    saveRecordDb(db, r)
    const key = recKey(r.mode, r.rank, r.source)
    const rec = loadRecordsDb(db)[key][0]
    expect('theme' in rec).toBe(false)
    expect(rec).toEqual(marathon())
  })

  it('endCondition はタグから列（ec_kind/ec_value）化し、キー分割と復元が仕様どおり', () => {
    const t60 = marathon({ endCondition: { kind: 'time', value: 60 }, keys: 100 })
    const t30 = marathon({ endCondition: { kind: 'time', value: 30 }, keys: 50 })
    const endless = marathon({ endCondition: { kind: 'endless' }, speed: 280, keys: 400 })
    for (const r of [t60, t30, endless]) saveRecordDb(db, r)
    const all = loadRecordsDb(db)
    // 既定 time60 はタグ無し＝従来キー。30秒は __T30、endless は __E で別キーに分かれる。
    const keyT60 = recKey('both', 1, 'sentence', undefined, { kind: 'time', value: 60 })
    const keyT30 = recKey('both', 1, 'sentence', undefined, { kind: 'time', value: 30 })
    const keyE = recKey('both', 1, 'sentence', undefined, { kind: 'endless' })
    expect(keyT30).toContain('__T30')
    expect(keyE).toContain('__E')
    expect(Object.keys(all).sort()).toEqual([keyT60, keyT30, keyE].sort())
    // endless の復元 endCondition は {kind:'endless'}（value は省略＝キー自体が無い）
    const ec = all[keyE][0].endCondition
    expect(ec.kind).toBe('endless')
    expect('value' in ec).toBe(false)
    // 全体として仕様どおり（現行 localStorage 像を明示リテラル化）
    expect(all).toEqual({
      both__r1: [marathon({ endCondition: { kind: 'time', value: 60 }, keys: 100 })],
      both__r1__T30: [marathon({ endCondition: { kind: 'time', value: 30 }, keys: 50 })],
      both__r1__E: [marathon({ endCondition: { kind: 'endless' }, speed: 280, keys: 400 })],
    })
  })

  it('任意列（mode/rank/source/seed/… と endCondition）が全て不在の疎な記録も仕様どおり round-trip する', () => {
    // 任意列を全て備えた記録と、それらが全て不在の疎な記録を同順で流し、
    // 各 nullable 列（bind の "?? null"）の「不在側」と、復元時の endCondition 省略分岐を通す。
    const full = marathon({ theme: 'ビジネス', keys: 150 })
    const sparse = {} // mode/rank/source/seed/speed/keys/mistakes/accuracy/correctCount/seconds/date/endCondition が全て不在
    for (const r of [full, sparse]) saveRecordDb(db, r)
    const all = loadRecordsDb(db)
    // 疎な記録は各任意プロパティも endCondition も持たない（null ではなく「不在」）
    const sparseRec = all[recKey(undefined, undefined, undefined)][0]
    expect(sparseRec).toEqual({})
    expect('endCondition' in sparseRec).toBe(false)
    expect(all).toEqual({
      'both__r1__ビジネス': [marathon({ theme: 'ビジネス', keys: 150 })],
      [recKey(undefined, undefined, undefined)]: [{}],
    })
  })

  it('同キーへ 16 件保存すると上位 15 件・順序が現行 compareRecords と一致する', () => {
    const ec = { kind: 'time', value: 60 }
    for (let i = 1; i <= MAX_RECORDS + 1; i++) {
      saveRecordDb(db, marathon({ keys: i, mistakes: 0, endCondition: ec }))
    }
    const key = recKey('both', 1, 'sentence', undefined, ec)
    const list = loadRecordsDb(db)[key]
    expect(list).toHaveLength(MAX_RECORDS)
    // keys=1 は溢れ、先頭は最大
    expect(list.some((r) => r.keys === 1)).toBe(false)
    expect(list[0].keys).toBe(MAX_RECORDS + 1)
    // 現行 compareRecords（time＝keys 降順）と同順
    const sorted = [...list].sort((a, b) => compareRecords(ec, a, b))
    expect(list.map((r) => r.keys)).toEqual(sorted.map((r) => r.keys))
    // keys=16..2 の 15 件が降順で並ぶ（keys=1 は溢れる）を明示リテラル化。
    expect(list).toEqual(
      Array.from({ length: MAX_RECORDS }, (_, i) =>
        marathon({ keys: MAX_RECORDS + 1 - i, mistakes: 0, endCondition: ec }),
      ),
    )
  })
})

// #364 dict/wsent 固定範囲：records 表に range 列を追加（migration version 4）。
// records 表は文章(sentence)・単語例文(wsent) を収容し、range を使うのは wsent のみ
// （sentence/touch/romaji は range=null）。range を持つ wsent 記録はキーが __R{range} で分かれ range を往復する。
// 非回帰オラクル（最重要）：range を持たない記録は従来キー・列像・range プロパティ無しで完全同値（byte 同一）。
describe('#364 records range 列の round-trip（後方互換＋wsent 範囲別記録）', () => {
  let db
  beforeEach(() => {
    db = freshDb()
  })

  // migration v4：applySchema（全 up 適用）後の records 表に range 列（INTEGER, nullable）がある。
  it('applySchema 後の records 表に range 列がある（migration version 4）', () => {
    const cols = db.selectObjects('PRAGMA table_info("records")').map((c) => c.name)
    expect(cols).toContain('range')
  })

  // 非回帰オラクル：range を持たない sentence 記録は従来キー・range プロパティ無しで戻る。
  // range 列（NULL）を足しても range 無し記録の像が不変であることを固定する。
  it('range を持たない sentence 記録は従来キー・range プロパティ無しで round-trip する（後方互換）', () => {
    const r = marathon({ keys: 70 })
    saveRecordDb(db, r)
    const key = recKey(r.mode, r.rank, r.source, r.theme, r.endCondition)
    const rec = loadRecordsDb(db)[key][0]
    expect('range' in rec).toBe(false)
    expect(rec).toEqual(marathon({ keys: 70 }))
  })

  // wsent でも range 無し（sentence 同様の従来記録）はキー・像不変・range=NULL で無影響。
  it('range を持たない wsent 記録も従来キー・range プロパティ無しで戻る', () => {
    const r = marathon({ mode: 'q', source: 'wsent', theme: '日常', keys: 60 })
    saveRecordDb(db, r)
    const key = recKey(r.mode, r.rank, r.source, r.theme, r.endCondition)
    expect(key).toBe('q__wsent1__日常')
    const rec = loadRecordsDb(db)[key][0]
    expect('range' in rec).toBe(false)
    expect(rec).toEqual(marathon({ mode: 'q', source: 'wsent', theme: '日常', keys: 60 }))
  })

  it('range=2 の wsent 記録は __R2 キーで戻り range:2 を保持する', () => {
    const r = marathon({ mode: 'q', source: 'wsent', theme: '日常', range: 2, keys: 50 })
    saveRecordDb(db, r)
    const all = loadRecordsDb(db)
    const key = recKey(r.mode, r.rank, r.source, r.theme, r.endCondition, 2)
    expect(key.endsWith('__R2')).toBe(true)
    expect(Object.keys(all)).toContain(key)
    expect(all[key][0].range).toBe(2)
    expect(all[key][0]).toEqual(
      marathon({ mode: 'q', source: 'wsent', theme: '日常', range: 2, keys: 50 }),
    )
  })

  it('同 mode/source/theme/ec でも range 有り無しは別キーで共存する', () => {
    const noRange = marathon({ mode: 'q', source: 'wsent', theme: '日常', keys: 40 })
    const withRange = marathon({ mode: 'q', source: 'wsent', theme: '日常', range: 2, keys: 50 })
    saveRecordDb(db, noRange)
    saveRecordDb(db, withRange)
    const all = loadRecordsDb(db)
    const baseKey = recKey('q', 1, 'wsent', '日常', { kind: 'time', value: 60 })
    const rangeKey = recKey('q', 1, 'wsent', '日常', { kind: 'time', value: 60 }, 2)
    expect(rangeKey).not.toBe(baseKey)
    expect(all[baseKey]).toEqual([marathon({ mode: 'q', source: 'wsent', theme: '日常', keys: 40 })])
    expect(all[rangeKey]).toEqual([
      marathon({ mode: 'q', source: 'wsent', theme: '日常', range: 2, keys: 50 }),
    ])
  })
})
