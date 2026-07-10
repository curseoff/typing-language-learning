// @vitest-environment jsdom
// #265 Phase2: 物語の永続化（発見エンド＋記録ランキング）の SQLite 写像＋round-trip（Red）。
// story 記録の実フィールド（source:'story', storyId, ending/endLabel, choices, segStats など。seed/level 無し）を写す。
// choices はオブジェクト配列なので JSON 列（choices）で round-trip。
// 検証オラクル＝現行 localStorage 実装と同値。
//
// 対象（未実装 API）:
//   src/infrastructure/db/schema.js          → applySchema(db)
//   src/infrastructure/db/repos/storyDb.js   →
//     saveStoryRecordDb(db, storyId, record) / loadStoryRecordsDb(db, storyId, endCondition)
//     loadAllStoryRecordsDb(db) / saveFoundDb(db, storyId, ids) / loadFoundDb(db, storyId)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../schema.js'
import {
  saveStoryRecordDb,
  loadStoryRecordsDb,
  loadAllStoryRecordsDb,
  saveFoundDb,
  loadFoundDb,
} from './storyDb.js'
import { storyRecKey } from '../../../domain/records/recordKeys.service.js'
import { MAX_RECORDS } from '../../../domain/records/ranking.service.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

const CHOICES = [
  { scene: 'start', choice: 'left' },
  { scene: 'fork', choice: 'right' },
]
const SEG_STATS = [{ seg: 'い', ms: 80, mistakes: 0 }]

// story 記録の実フィールド（endCondition・seed・level は無い）。
function story(overrides = {}) {
  return {
    source: 'story',
    mode: 'both',
    storyId: 'climbing',
    ending: 'summit',
    endLabel: '登頂',
    speed: 230,
    keys: 140,
    mistakes: 2,
    accuracy: 0.98,
    seconds: 45,
    segStats: SEG_STATS,
    choices: CHOICES,
    date: '2026/7/4 12:00:00',
    ...overrides,
  }
}

describe('#265 infrastructure/db/repos/storyDb（現行 localStorage 実装と同値）', () => {
  let db
  beforeEach(() => {
    db = freshDb()
  })

  it('発見エンドを発見順を保ったまま round-trip する（追記で順序が崩れない）', () => {
    saveFoundDb(db, 'climbing', ['a', 'b'])
    expect(loadFoundDb(db, 'climbing')).toEqual(['a', 'b'])

    saveFoundDb(db, 'climbing', ['a', 'b', 'c'])
    expect(loadFoundDb(db, 'climbing')).toEqual(['a', 'b', 'c'])
  })

  it('発見エンドは storyId ごとに分離する', () => {
    saveFoundDb(db, 'climbing', ['x'])
    saveFoundDb(db, 'travel', ['y', 'z'])
    expect(loadFoundDb(db, 'climbing')).toEqual(['x'])
    expect(loadFoundDb(db, 'travel')).toEqual(['y', 'z'])
  })

  it('物語記録を rankInsert 順（keys 降順）で保存し、仕様どおり読み戻す', () => {
    for (const keys of [10, 30, 20]) saveStoryRecordDb(db, 'climbing', story({ keys }))
    const list = loadStoryRecordsDb(db, 'climbing')
    expect(list.map((r) => r.keys)).toEqual([30, 20, 10])
    // 期待値は現行 localStorage 実装の最終像を明示リテラル化（keys 降順）。
    expect(list).toEqual([story({ keys: 30 }), story({ keys: 20 }), story({ keys: 10 })])
  })

  it('MAX_RECORDS 件で打ち切る', () => {
    for (let i = 1; i <= MAX_RECORDS + 3; i++) saveStoryRecordDb(db, 'climbing', story({ keys: i }))
    const list = loadStoryRecordsDb(db, 'climbing')
    expect(list).toHaveLength(MAX_RECORDS)
    expect(list[0].keys).toBe(MAX_RECORDS + 3)
    // keys=18..4 の 15 件が降順で並ぶ（keys=1..3 は溢れる）を明示リテラル化。
    expect(list).toEqual(
      Array.from({ length: MAX_RECORDS }, (_, i) => story({ keys: MAX_RECORDS + 3 - i })),
    )
  })

  it('choices/segStats（オブジェクト配列）は JSON 列として同じ内容で戻る', () => {
    const r = story({ choices: CHOICES, segStats: SEG_STATS })
    saveStoryRecordDb(db, 'climbing', r)
    const rec = loadStoryRecordsDb(db, 'climbing')[0]
    expect(rec.choices).toEqual(CHOICES)
    expect(rec.segStats).toEqual(SEG_STATS)
    expect(rec).toEqual(story({ choices: CHOICES, segStats: SEG_STATS }))
  })

  it('choices が無い記録は復元後に choices プロパティが存在しない', () => {
    const r = story()
    delete r.choices
    saveStoryRecordDb(db, 'climbing', r)
    const rec = loadStoryRecordsDb(db, 'climbing')[0]
    expect('choices' in rec).toBe(false)
  })

  it('任意列（mode/source/ending/… と segStats/choices）が全て不在の疎な物語記録も仕様どおり round-trip する', () => {
    // 任意列を全て備えた記録と、それらが全て不在の疎な記録を同じグループ（endCondition 無し）へ流し、
    // 各 nullable 列（bind の "?? null"）の「不在側」と segStats/choices の省略分岐を通す。
    const full = story({ keys: 50 })
    // storyId は列（story_id）由来で復元時に必ず付く＝現行 record も storyId を持つ。それ以外の任意列は全て不在。
    const sparse = { storyId: 'climbing' }
    saveStoryRecordDb(db, 'climbing', full)
    saveStoryRecordDb(db, 'climbing', sparse)
    const list = loadStoryRecordsDb(db, 'climbing')
    // keys 降順で full(50) が上、疎な記録は storyId 以外を持たない
    expect(list[1]).toEqual({ storyId: 'climbing' })
    expect(list).toEqual([story({ keys: 50 }), { storyId: 'climbing' }])
  })

  describe('loadAllStoryRecordsDb（全 storyId 集約・キーは storyRecKey 形）', () => {
    it('未保存なら空マップを返す', () => {
      expect(loadAllStoryRecordsDb(db)).toEqual({})
    })

    it('複数 storyId の記録を storyRecKey→配列マップで束ね、仕様どおりになる', () => {
      const a = story({ storyId: 'climbing', keys: 10 })
      const b = story({ storyId: 'travel', keys: 20, ending: 'arrive', endLabel: '到着' })
      saveStoryRecordDb(db, 'climbing', a)
      saveStoryRecordDb(db, 'travel', b)
      const all = loadAllStoryRecordsDb(db)
      // キーは storyRecKey 形（= 現行 localStorage キー）
      expect(Object.keys(all).sort()).toEqual(
        [storyRecKey('climbing'), storyRecKey('travel')].sort(),
      )
      expect(all[storyRecKey('climbing')].map((r) => r.keys)).toEqual([10])
      expect(all[storyRecKey('travel')].map((r) => r.keys)).toEqual([20])
      // 期待値は現行 localStorage 実装の最終像を明示リテラル化。
      expect(all).toEqual({
        [storyRecKey('climbing')]: [story({ storyId: 'climbing', keys: 10 })],
        [storyRecKey('travel')]: [
          story({ storyId: 'travel', keys: 20, ending: 'arrive', endLabel: '到着' }),
        ],
      })
    })
  })

  it('終了条件別バリアントは別キーで分離し、仕様どおり読み戻す（endCondition を持つ記録）', () => {
    const base = story({ keys: 10 }) // endCondition 無し＝base キー
    const endless = story({ keys: 30, endCondition: { kind: 'endless' } })
    saveStoryRecordDb(db, 'climbing', base)
    saveStoryRecordDb(db, 'climbing', endless)
    // base と endless は別キーへ分かれる
    expect(loadStoryRecordsDb(db, 'climbing').map((r) => r.keys)).toEqual([10])
    expect(loadStoryRecordsDb(db, 'climbing', { kind: 'endless' }).map((r) => r.keys)).toEqual([30])
    // 各終了条件の最終像を明示リテラル化
    expect(loadStoryRecordsDb(db, 'climbing')).toEqual([story({ keys: 10 })])
    expect(loadStoryRecordsDb(db, 'climbing', { kind: 'endless' })).toEqual([
      story({ keys: 30, endCondition: { kind: 'endless' } }),
    ])
  })
})
