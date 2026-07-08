// @vitest-environment jsdom
// #265 Phase2: 問題ごとの累積記録（item_stats）のフル関係テーブル写像＋round-trip（Red）。
// id は 'type:mode:key' 形式。id 内に ':' を含みうる（例文の文中コロン）ので、
// type/mode/item_key の分解は先頭2つの ':' のみで行い、load では id 原文が復元されること。
// 検証オラクル＝現行 itemStatsRepository と同値。
//
// 対象（未実装 API）:
//   src/infrastructure/db/schema.js             → applySchema(db)
//   src/infrastructure/db/repos/itemStatsDb.js  → recordItemStatDb(db, id, {keys,mistakes,ms}) / loadItemStatsDb(db)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../schema.js'
import { recordItemStatDb, loadItemStatsDb } from './itemStatsDb.js'
import { recordItemStat, loadItemStats, itemId } from '../../itemStatsRepository.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

describe('#265 infrastructure/db/repos/itemStatsDb（現行 itemStatsRepository と同値）', () => {
  let db
  beforeEach(() => {
    localStorage.clear()
    db = freshDb()
  })

  it('新規 id を count=1 から初期化する', () => {
    recordItemStat('w:en:reserve', { keys: 7, mistakes: 1, ms: 200 })
    recordItemStatDb(db, 'w:en:reserve', { keys: 7, mistakes: 1, ms: 200 })
    expect(loadItemStatsDb(db)['w:en:reserve']).toEqual({ count: 1, keys: 7, mistakes: 1, ms: 200 })
    expect(loadItemStatsDb(db)).toEqual(loadItemStats())
  })

  it('同 id を2回記録すると count=2・keys/mistakes/ms が合算される', () => {
    const id = itemId('d', 'ja', 'hotel')
    for (const s of [
      { keys: 5, mistakes: 1, ms: 100 },
      { keys: 3, mistakes: 2, ms: 50 },
    ]) {
      recordItemStat(id, s)
      recordItemStatDb(db, id, s)
    }
    expect(loadItemStatsDb(db)[id]).toEqual({ count: 2, keys: 8, mistakes: 3, ms: 150 })
    expect(loadItemStatsDb(db)).toEqual(loadItemStats())
  })

  it('id が : を含んでも（文中コロン）原文どおり復元する（分解は先頭2つの : のみ）', () => {
    const id = 's:both:I go to school: today.'
    recordItemStat(id, { keys: 20, mistakes: 0, ms: 400 })
    recordItemStatDb(db, id, { keys: 20, mistakes: 0, ms: 400 })
    const loaded = loadItemStatsDb(db)
    // id 原文をキーとして持つ（'today.' 以降が欠けたり別 id に化けたりしない）
    expect(Object.keys(loaded)).toContain(id)
    expect(loaded[id]).toEqual({ count: 1, keys: 20, mistakes: 0, ms: 400 })
    expect(loaded).toEqual(loadItemStats())
  })

  it('複数 id を混在記録しても現行と同値に round-trip する', () => {
    const ops = [
      ['w:en:reserve', { keys: 7, mistakes: 1, ms: 200 }],
      ['d:ja:hotel', { keys: 5, mistakes: 0, ms: 90 }],
      ['s:both:I go.', { keys: 4, mistakes: 0, ms: 80 }],
      ['w:en:reserve', { keys: 6, mistakes: 2, ms: 150 }],
    ]
    for (const [id, s] of ops) {
      recordItemStat(id, s)
      recordItemStatDb(db, id, s)
    }
    expect(loadItemStatsDb(db)).toEqual(loadItemStats())
  })
})
