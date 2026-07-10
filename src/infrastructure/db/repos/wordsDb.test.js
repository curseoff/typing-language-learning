// @vitest-environment jsdom
// #265 Phase2: 単語問題記録の SQLite 関係スキーマ写像＋round-trip（Red）。
// word_records 表は「word 通常（useWords）」と「word クイズ（useWordQuiz）」の両方を収容する。
// segStats はオブジェクト配列なので JSON 列（seg_stats）で round-trip、クイズ固有 correct/words は nullable。
// 検証オラクル＝現行 localStorage 実装と同値。
//
// 対象（未実装 API）:
//   src/infrastructure/db/applySchema.schema.js          → applySchema(db)
//   src/infrastructure/db/repos/words.repository.js    → saveWordRecordDb(db, record) / loadWordRecordsDb(db)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../applySchema.schema.js'
import { saveWordRecordDb, loadWordRecordsDb } from './words.repository.js'
import { wordRecKey } from '../../../domain/records/recordKeys.service.js'

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
  { seg: 'よ', ms: 120, mistakes: 0 },
  { seg: 'やく', ms: 240, mistakes: 1 },
]

// word 通常（useWords）の実フィールド。
function wordNormal(overrides = {}) {
  return {
    source: 'word',
    seed: 777,
    endCondition: { kind: 'time', value: 60 },
    level: 2,
    theme: '旅行',
    mode: 'en',
    speed: 210,
    keys: 88,
    mistakes: 2,
    accuracy: 0.98,
    correctCount: 12,
    seconds: 60,
    segStats: SEG_STATS,
    date: '2026-07-02T00:00:00.000Z',
    ...overrides,
  }
}

// word クイズ（useWordQuiz）: 通常＋correct/words（mode は入力モード）。
function wordQuiz(overrides = {}) {
  return {
    ...wordNormal(),
    correct: 9,
    correctCount: 9,
    words: 10,
    ...overrides,
  }
}

describe('#265 infrastructure/db/repos/wordsDb（現行 localStorage 実装と同値）', () => {
  let db
  beforeEach(() => {
    db = freshDb()
  })

  it('通常＋クイズを混在させても仕様どおり round-trip する', () => {
    const records = [
      wordNormal({ keys: 88 }),
      wordNormal({ keys: 120, theme: 'ビジネス', level: 3 }),
      wordQuiz({ keys: 60, mode: 'ja' }),
      wordNormal({ endCondition: { kind: 'items', value: 20 }, keys: 44 }),
    ]
    for (const r of records) saveWordRecordDb(db, r)
    // 期待値は現行 localStorage 実装の最終像を明示リテラル化（レベル×テーマ×モード×終了条件でキー分割）。
    expect(loadWordRecordsDb(db)).toEqual({
      'L2__旅行__en': [wordNormal({ keys: 88 })],
      'L3__ビジネス__en': [wordNormal({ keys: 120, theme: 'ビジネス', level: 3 })],
      'L2__旅行__ja': [wordQuiz({ keys: 60, mode: 'ja' })],
      'L2__旅行__en__I20': [wordNormal({ endCondition: { kind: 'items', value: 20 }, keys: 44 })],
    })
  })

  it('segStats（オブジェクト配列）は JSON 列として同じ内容で戻る', () => {
    const r = wordNormal({ segStats: SEG_STATS })
    saveWordRecordDb(db, r)
    const key = wordRecKey(r.level, r.theme, r.mode, r.endCondition)
    const rec = loadWordRecordsDb(db)[key][0]
    expect(rec.segStats).toEqual(SEG_STATS)
    expect(rec).toEqual(wordNormal({ segStats: SEG_STATS }))
  })

  it('segStats が無い記録は復元後に segStats プロパティが存在しない', () => {
    const r = wordNormal()
    delete r.segStats
    saveWordRecordDb(db, r)
    const key = wordRecKey(r.level, r.theme, r.mode, r.endCondition)
    const rec = loadWordRecordsDb(db)[key][0]
    expect('segStats' in rec).toBe(false)
  })

  it('任意列（source/seed/level/theme/mode/… と correct/words/segStats/endCondition）が全て不在の疎な記録も仕様どおり round-trip する', () => {
    // 任意列を全て備えたクイズ記録と、それらが全て不在の疎な記録を同順で流し、
    // 各 nullable 列（bind の "?? null"）の「不在側」・endCondition/segStats の省略分岐を通す。
    const full = wordQuiz({ theme: 'ビジネス', level: 4, keys: 99 })
    const sparse = {} // 全ての任意列（correct/correctCount/words/segStats 含む）と endCondition が不在
    for (const r of [full, sparse]) saveWordRecordDb(db, r)
    const all = loadWordRecordsDb(db)
    const sparseRec = all[wordRecKey(undefined, undefined, undefined)][0]
    expect(sparseRec).toEqual({})
    expect(all).toEqual({
      'L4__ビジネス__en': [wordQuiz({ theme: 'ビジネス', level: 4, keys: 99 })],
      [wordRecKey(undefined, undefined, undefined)]: [{}],
    })
  })

  it('クイズ固有 correct/words は nullable：通常記録では省略復元、クイズ記録では保持する', () => {
    const normal = wordNormal({ theme: '日常', keys: 30 })
    const quiz = wordQuiz({ theme: '日常', mode: 'ja', keys: 31 })
    saveWordRecordDb(db, normal)
    saveWordRecordDb(db, quiz)
    const normalKey = wordRecKey(normal.level, normal.theme, normal.mode, normal.endCondition)
    const quizKey = wordRecKey(quiz.level, quiz.theme, quiz.mode, quiz.endCondition)
    const normalRec = loadWordRecordsDb(db)[normalKey][0]
    const quizRec = loadWordRecordsDb(db)[quizKey][0]
    // 通常記録は correct/words プロパティ自体が無い
    expect('correct' in normalRec).toBe(false)
    expect('words' in normalRec).toBe(false)
    // クイズ記録は値を保持
    expect(quizRec.correct).toBe(9)
    expect(quizRec.words).toBe(10)
    // 全体として仕様どおり（現行 localStorage 像を明示リテラル化）
    expect(loadWordRecordsDb(db)).toEqual({
      'L2__日常__en': [wordNormal({ theme: '日常', keys: 30 })],
      'L2__日常__ja': [wordQuiz({ theme: '日常', mode: 'ja', keys: 31 })],
    })
  })
})
