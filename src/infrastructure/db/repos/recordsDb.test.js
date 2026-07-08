// @vitest-environment jsdom
// #265 Phase2: マラソン記録の SQLite 関係スキーマ写像＋round-trip（Red）。
// 検証オラクル＝「現行 localStorage リポジトリ（recordsRepository）と同値」。
// 同じ入力を現行 saveRecord と新 saveRecordDb に同順で流し、load 結果が deepEqual であることを主軸にする。
// 加えて壊れやすい点（undefined 省略・endCondition 再生成・上位15キャップ）は個別アサーションも置く。
//
// 対象（coder が後で実装する未実装 API）:
//   src/infrastructure/db/schema.js        → applySchema(db)
//   src/infrastructure/db/repos/recordsDb.js → saveRecordDb(db, record) / loadRecordsDb(db)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../schema.js'
import { saveRecordDb, loadRecordsDb } from './recordsDb.js'
import { saveRecord, loadRecords } from '../../recordsRepository.js'
import { recKey, MAX_RECORDS, compareRecords } from '../../../domain/records/ranking.js'

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

describe('#265 infrastructure/db/repos/recordsDb（現行 recordsRepository と同値）', () => {
  let db
  beforeEach(() => {
    localStorage.clear()
    db = freshDb()
  })

  it('複数キー（source/theme/endCondition 別）の一連の記録を現行と同値に round-trip する', () => {
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
    for (const r of records) {
      saveRecord(r)
      saveRecordDb(db, r)
    }
    expect(loadRecordsDb(db)).toEqual(loadRecords())
  })

  it('theme 無しの記録は復元後に theme プロパティが「存在しない」（null ではない）', () => {
    const r = marathon() // theme を渡さない
    saveRecord(r)
    saveRecordDb(db, r)
    const key = recKey(r.mode, r.rank, r.source)
    const rec = loadRecordsDb(db)[key][0]
    expect('theme' in rec).toBe(false)
    expect(rec).toEqual(loadRecords()[key][0])
  })

  it('endCondition はタグから列（ec_kind/ec_value）化し、キー分割と復元が現行と一致する', () => {
    const t60 = marathon({ endCondition: { kind: 'time', value: 60 }, keys: 100 })
    const t30 = marathon({ endCondition: { kind: 'time', value: 30 }, keys: 50 })
    const endless = marathon({ endCondition: { kind: 'endless' }, speed: 280, keys: 400 })
    for (const r of [t60, t30, endless]) {
      saveRecord(r)
      saveRecordDb(db, r)
    }
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
    // 全体として現行と同値
    expect(all).toEqual(loadRecords())
  })

  it('同キーへ 16 件保存すると上位 15 件・順序が現行 compareRecords と一致する', () => {
    const ec = { kind: 'time', value: 60 }
    for (let i = 1; i <= MAX_RECORDS + 1; i++) {
      const r = marathon({ keys: i, mistakes: 0, endCondition: ec })
      saveRecord(r)
      saveRecordDb(db, r)
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
    // 現行と同値
    expect(list).toEqual(loadRecords()[key])
  })
})
