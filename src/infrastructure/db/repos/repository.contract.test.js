// @vitest-environment jsdom
// 既存の DB リポジトリ（.repository.js）を共通契約に載せるメタテスト。#329。
// ranking 系4対象（records / story / wordDict の word_records・dict_records）を assertRepository、
// itemStats（累積カウンタ）を assertAccumulatorRepository に載せる。
// これらは同じ round-trip 同値・backing 分離の契約を満たし、ranking 系は上限/整列/押し出しの
// 不変条件も保つ（sqlite backing で成立＝domain Port と同契約が別実装で成り立つ）。
// #323 の VO 契約・#324 の Entity 契約・#325 の Aggregate 契約と対になる。
// ファイル名は .test.js ＝命名メタテスト（.repository.js サフィックス強制）の対象外。
import { describe, beforeAll } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../applySchema.schema.js'
import { saveRecordDb, loadRecordsDb } from './records.repository.js'
import { saveStoryRecordDb, loadStoryRecordsDb } from './story.repository.js'
import { makeWordDictDb } from './wordDict.repository.js'
import { recordItemStatDb, loadItemStatsDb } from './itemStats.repository.js'
import { assertRepository } from '../../../test/contracts/repository.js'
import { assertAccumulatorRepository } from '../../../test/contracts/accumulatorRepository.js'
import { recKey, MAX_RECORDS, compareRecords } from '../../../domain/records/ranking.service.js'
import {
  storyRecKey,
  wordRecKey,
  dictRecKey,
  itemId,
} from '../../../domain/records/recordKeys.service.js'
import { makeEndCondition } from '../../../domain/session/endCondition.vo.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

// 各 newRepo で「まっさらな backing」を作る（sqlite3 は beforeAll 後にのみ存在＝it() 内で遅延生成）。
const freshDb = () => {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

const EC = makeEndCondition('time', 60)
const ecPlain = { kind: 'time', value: 60 } // record が持つ生の形（ecToColumns⇄ecFromRow で往復する形）

// 独立な構造等価（repo 内部を再呼びせず素のロジックで判定）。
const eq = (a, b) => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => eq(a[k], b[k]))
}
const reflectsOne = (stored, record) => stored.some((x) => eq(x, record))
// 独立比較器（time60＝keys 降順）で昇位順に並んでいるか。
const isSorted = (list) =>
  list.every((_, i) => i === 0 || compareRecords(EC, list[i - 1], list[i]) <= 0)

describe('Repository契約: records（マラソン記録・sqlite backing）', () => {
  const sample = (i = 0) => ({
    mode: 'both',
    rank: 1,
    source: 'sentence',
    endCondition: ecPlain,
    keys: 100 + i,
    mistakes: 0,
    date: '2026-01-01',
  })
  assertRepository({
    newRepo: () => {
      const db = freshDb()
      return { save: (r) => saveRecordDb(db, r), load: (key) => loadRecordsDb(db)[key] ?? [] }
    },
    keyFor: (r) => recKey(r.mode, r.rank, r.source, r.theme, r.endCondition),
    sample,
    reflectsOne,
    isSorted,
    cap: MAX_RECORDS,
    worse: { ...sample(0), keys: 0 },
  })
})

describe('Repository契約: story（物語記録・sqlite backing）', () => {
  // storyId は列（story_id）由来で復元時に必ず付く＝round-trip 同値のため sample にも含める。
  const sample = (i = 0) => ({
    storyId: 'demo',
    ending: 'good',
    endCondition: ecPlain,
    keys: 100 + i,
    mistakes: 0,
    date: '2026-01-01',
  })
  assertRepository({
    newRepo: () => {
      const db = freshDb()
      return {
        save: (r) => saveStoryRecordDb(db, 'demo', r),
        load: () => loadStoryRecordsDb(db, 'demo', EC),
      }
    },
    keyFor: () => storyRecKey('demo', EC),
    sample,
    reflectsOne,
    isSorted,
    cap: MAX_RECORDS,
    worse: { ...sample(0), keys: 0 },
  })
})

// word_records と dict_records は table 名とキー関数が違うだけの同一写像＝2適用で同契約を確認する。
for (const [label, table, keyFn] of [
  ['word_records', 'word_records', wordRecKey],
  ['dict_records', 'dict_records', dictRecKey],
]) {
  describe(`Repository契約: wordDict/${label}（sqlite backing）`, () => {
    const repo = makeWordDictDb(table, keyFn)
    const sample = (i = 0) => ({
      level: 3,
      theme: '日常',
      mode: 'both',
      endCondition: ecPlain,
      keys: 100 + i,
      mistakes: 0,
      date: '2026-01-01',
    })
    assertRepository({
      newRepo: () => {
        const db = freshDb()
        return { save: (r) => repo.save(db, r), load: (key) => repo.load(db)[key] ?? [] }
      },
      keyFor: (r) => keyFn(r.level, r.theme, r.mode, r.endCondition),
      sample,
      reflectsOne,
      isSorted,
      cap: MAX_RECORDS,
      worse: { ...sample(0), keys: 0 },
    })
  })
}

describe('AccumulatorRepository契約: itemStats（累積カウンタ・sqlite backing）', () => {
  const ID = itemId('w', 'en', 'reserve')
  const sample = (i = 0) => ({ keys: 5 + i, mistakes: 0, ms: (5 + i) * 10 })
  // 素の JS で合算する独立オラクル（count=件数・各値の総和）。
  const sum = (stats) =>
    stats.reduce(
      (a, s) => ({
        count: a.count + 1,
        keys: a.keys + s.keys,
        mistakes: a.mistakes + s.mistakes,
        ms: a.ms + s.ms,
      }),
      { count: 0, keys: 0, mistakes: 0, ms: 0 },
    )
  assertAccumulatorRepository({
    newRepo: () => {
      const db = freshDb()
      return { save: (s) => recordItemStatDb(db, ID, s), load: () => loadItemStatsDb(db)[ID] }
    },
    keyFor: () => ID,
    sample,
    sum,
    emptyLoad: (s) => s == null,
  })
})
