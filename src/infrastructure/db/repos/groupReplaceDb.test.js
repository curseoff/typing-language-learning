// @vitest-environment jsdom
// #451 記録の1件削除：DB 側の「グループ置換」（replace*GroupDb）の仕様。
// 削除専用 SQL は持たず、メモリ像（正）の削除後配列でグループを丸ごと入れ替える設計なので、
// ここでは「該当グループだけが list どおりに入れ替わる」「他グループが巻き添えにならない」
// 「空 list でグループの行が 1 本も残らない」を 4 リポジトリすべてで固定する。
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../applySchema.schema.js'
import { saveRecordDb, loadRecordsDb, replaceRecordsGroupDb } from './records.repository.js'
import {
  saveWordRecordDb,
  loadWordRecordsDb,
  replaceWordRecordsGroupDb,
} from './words.repository.js'
import {
  saveDictRecordDb,
  loadDictRecordsDb,
  replaceDictRecordsGroupDb,
} from './dict.repository.js'
import {
  saveStoryRecordDb,
  loadAllStoryRecordsDb,
  replaceStoryRecordsGroupDb,
} from './story.repository.js'
import { recKey } from '../../../domain/records/ranking.service.js'
import { wordRecKey, dictRecKey, storyRecKey } from '../../../domain/records/recordKeys.service.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

describe('#451 records のグループ置換', () => {
  let db
  const rec = (o) => ({ mode: 'both', rank: 1, source: 'sentence', mistakes: 0, ...o })
  const KEY = recKey('both', 1, 'sentence')
  const OTHER_KEY = recKey('q', 1, 'wsent', '旅行')
  const other = rec({ mode: 'q', source: 'wsent', theme: '旅行', keys: 55, date: 'o' })

  beforeEach(() => {
    db = freshDb()
    saveRecordDb(db, rec({ keys: 300, date: 'a' }))
    saveRecordDb(db, rec({ keys: 200, date: 'b' }))
    saveRecordDb(db, rec({ keys: 100, date: 'c' }))
    saveRecordDb(db, other) // 巻き添え検出用の別グループ
  })

  it('該当グループが list どおりに入れ替わり、他グループは無傷', () => {
    const rest = [rec({ keys: 300, date: 'a' }), rec({ keys: 100, date: 'c' })]
    const all = replaceRecordsGroupDb(db, rest[0], rest)
    expect(all[KEY]).toEqual(rest)
    expect(all[OTHER_KEY]).toEqual([other])
  })

  it('置換後も pos 昇順（渡した list の並び）で読み戻る', () => {
    const rest = [rec({ keys: 100, date: 'c' }), rec({ keys: 300, date: 'a' })]
    expect(replaceRecordsGroupDb(db, rest[0], rest)[KEY].map((r) => r.date)).toEqual(['c', 'a'])
  })

  it('空 list ならグループごと消える（他グループは残る）', () => {
    const all = replaceRecordsGroupDb(db, rec({ keys: 300, date: 'a' }), [])
    expect(KEY in all).toBe(false)
    expect(all[OTHER_KEY]).toEqual([other])
  })
})

// word_records / dict_records は同一ファクトリ由来＝表とキー関数だけが違うので 2 適用で確認する。
for (const [label, saveDb, loadDb, replaceDb, keyFn] of [
  ['word', saveWordRecordDb, loadWordRecordsDb, replaceWordRecordsGroupDb, wordRecKey],
  ['dict', saveDictRecordDb, loadDictRecordsDb, replaceDictRecordsGroupDb, dictRecKey],
]) {
  describe(`#451 ${label}_records のグループ置換`, () => {
    let db
    const rec = (o) => ({ level: 3, theme: '日常', mode: 'en', mistakes: 0, ...o })
    const KEY = keyFn(3, '日常', 'en')
    const OTHER_KEY = keyFn(1, 'ビジネス', 'ja')
    const other = rec({ level: 1, theme: 'ビジネス', mode: 'ja', keys: 44, date: 'o' })

    beforeEach(() => {
      db = freshDb()
      saveDb(db, rec({ keys: 90, date: 'a' }))
      saveDb(db, rec({ keys: 80, date: 'b' }))
      saveDb(db, other)
    })

    it('該当グループが list どおりに入れ替わり、他グループは無傷', () => {
      const rest = [rec({ keys: 80, date: 'b' })]
      const all = replaceDb(db, rest[0], rest)
      expect(all[KEY]).toEqual(rest)
      expect(all[OTHER_KEY]).toEqual([other])
    })

    it('空 list ならグループごと消える（他グループは残る）', () => {
      const all = replaceDb(db, rec({ keys: 90, date: 'a' }), [])
      expect(KEY in all).toBe(false)
      expect(all[OTHER_KEY]).toEqual([other])
      expect(loadDb(db)).toEqual(all)
    })
  })
}

describe('#451 story_records のグループ置換', () => {
  let db
  const rec = (o) => ({ storyId: 'travel', source: 'story', mode: 'both', mistakes: 0, ...o })
  const KEY = storyRecKey('travel')
  const OTHER_KEY = storyRecKey('climbing')
  const other = { ...rec({ keys: 33, date: 'o' }), storyId: 'climbing' }

  beforeEach(() => {
    db = freshDb()
    saveStoryRecordDb(db, 'travel', rec({ keys: 50, date: 'a' }))
    saveStoryRecordDb(db, 'travel', rec({ keys: 40, date: 'b' }))
    saveStoryRecordDb(db, 'climbing', other) // 別 storyId は巻き添えにしない
  })

  it('該当 storyId のグループだけ入れ替わる', () => {
    const rest = [rec({ keys: 40, date: 'b' })]
    expect(replaceStoryRecordsGroupDb(db, 'travel', rest[0], rest)).toEqual(rest)
    const all = loadAllStoryRecordsDb(db)
    expect(all[KEY]).toEqual(rest)
    expect(all[OTHER_KEY]).toEqual([other])
  })

  it('空 list ならグループごと消える（他 storyId は残る）', () => {
    expect(replaceStoryRecordsGroupDb(db, 'travel', rec({ keys: 50, date: 'a' }), [])).toEqual([])
    const all = loadAllStoryRecordsDb(db)
    expect(KEY in all).toBe(false)
    expect(all[OTHER_KEY]).toEqual([other])
  })
})
