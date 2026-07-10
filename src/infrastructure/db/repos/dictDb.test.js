// @vitest-environment jsdom
// #265 Phase2: 英英辞典クイズ記録の SQLite 関係スキーマ写像＋round-trip（Red）。
// dict クイズの実フィールド（source:'dict', mode:kind, correct/words/segStats など）を表に写す。
// 検証オラクル＝現行 localStorage 実装と同値。
//
// 対象（未実装 API）:
//   src/infrastructure/db/applySchema.schema.js         → applySchema(db)
//   src/infrastructure/db/repos/dict.repository.js   → saveDictRecordDb(db, record) / loadDictRecordsDb(db)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../applySchema.schema.js'
import { saveDictRecordDb, loadDictRecordsDb } from './dict.repository.js'
import { dictRecKey } from '../../../domain/records/recordKeys.service.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

const SEG_STATS = [
  { seg: 'ほ', ms: 100, mistakes: 0 },
  { seg: 'てる', ms: 220, mistakes: 2 },
]

// dict クイズ（useDictQuiz）の実フィールド。
function dictQuiz(overrides = {}) {
  return {
    source: 'dict',
    seed: 909,
    endCondition: { kind: 'time', value: 60 },
    level: 1,
    theme: '旅行',
    mode: 'ja',
    keys: 70,
    speed: 190,
    correct: 8,
    correctCount: 8,
    words: 10,
    mistakes: 1,
    accuracy: 0.99,
    seconds: 60,
    segStats: SEG_STATS,
    date: '2026-07-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('#265 infrastructure/db/repos/dictDb（現行 localStorage 実装と同値）', () => {
  let db
  beforeEach(() => {
    db = freshDb()
  })

  it('複数キーの一連の記録を仕様どおり round-trip する', () => {
    const records = [
      dictQuiz({ keys: 70 }),
      dictQuiz({ keys: 120, theme: 'ビジネス', level: 3, mode: 'en' }),
      dictQuiz({ endCondition: { kind: 'life', value: 3 }, keys: 33 }),
    ]
    for (const r of records) saveDictRecordDb(db, r)
    // 期待値は現行 localStorage 実装の最終像を明示リテラル化（レベル×テーマ×モード×終了条件でキー分割）。
    expect(loadDictRecordsDb(db)).toEqual({
      'L1__旅行__ja': [dictQuiz({ keys: 70 })],
      'L3__ビジネス__en': [dictQuiz({ keys: 120, theme: 'ビジネス', level: 3, mode: 'en' })],
      'L1__旅行__ja__L3': [dictQuiz({ endCondition: { kind: 'life', value: 3 }, keys: 33 })],
    })
  })

  it('segStats（オブジェクト配列）は JSON 列として同じ内容で戻る', () => {
    const r = dictQuiz({ segStats: SEG_STATS })
    saveDictRecordDb(db, r)
    const key = dictRecKey(r.level, r.theme, r.mode, r.endCondition)
    const rec = loadDictRecordsDb(db)[key][0]
    expect(rec.segStats).toEqual(SEG_STATS)
    expect(rec).toEqual(dictQuiz({ segStats: SEG_STATS }))
  })

  it('segStats が無い記録は復元後に segStats プロパティが存在しない', () => {
    const r = dictQuiz()
    delete r.segStats
    saveDictRecordDb(db, r)
    const key = dictRecKey(r.level, r.theme, r.mode, r.endCondition)
    const rec = loadDictRecordsDb(db)[key][0]
    expect('segStats' in rec).toBe(false)
  })
})
