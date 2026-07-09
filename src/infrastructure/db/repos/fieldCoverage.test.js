// @vitest-environment jsdom
// #267 [#264 Phase4] 列被覆ガード（3c 昇格の前提）。
// records / word_records / dict_records / story_records / item_stats は固定カラムのため、
// 実ビルダー（application/use*.js）が載せる「全フィールド入り record」を save→load したとき、
// 元の全フィールドが round-trip する（黙って落ちる列が無い）ことを担保する。
// もし現状スキーマで落ちるフィールドがあれば、toEqual が欠けを検出して赤になる
// （＝この時点で coder/司令塔がスキーマ拡張要否を判断する）。既に十分なら緑のガードとして残る。
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { applySchema } from '../schema.js'
import { saveRecordDb, loadRecordsDb } from './recordsDb.js'
import { saveWordRecordDb, loadWordRecordsDb } from './wordsDb.js'
import { saveDictRecordDb, loadDictRecordsDb } from './dictDb.js'
import { saveStoryRecordDb, loadStoryRecordsDb } from './storyDb.js'
import { recordItemStatDb, loadItemStatsDb } from './itemStatsDb.js'

let sqlite3
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule()
})

function freshDb() {
  const db = new sqlite3.oo1.DB()
  applySchema(db)
  return db
}

// 単一グループに1件だけ保存した場合の唯一の record を取り出す。
function onlyRecord(map) {
  return Object.values(map)[0][0]
}

const SEG_STATS = [
  { seg: 'り', ms: 90, mistakes: 0 },
  { seg: 'ん', ms: 120, mistakes: 1 },
]
const CHOICES = [
  { scene: 'start', choice: 'left' },
  { scene: 'fork', choice: 'right' },
]
const EC = { kind: 'time', value: 60 }

describe('#267 列被覆ガード: 実ビルダー相当の全フィールドが save→load で round-trip する', () => {
  let db
  beforeEach(() => {
    db = freshDb()
  })

  it('marathon（records）: useMarathon の全フィールドが一致する', () => {
    // useMarathon.js の record 実フィールド一式。
    const rec = {
      mode: 'both',
      rank: 1,
      source: 'sentence',
      theme: '旅行',
      seed: 12345,
      endCondition: EC,
      speed: 250,
      keys: 120,
      mistakes: 3,
      accuracy: 0.97,
      correctCount: 5,
      seconds: 60,
      date: '2026/7/9 9:22:10',
    }
    saveRecordDb(db, rec)
    expect(onlyRecord(loadRecordsDb(db))).toEqual(rec)
  })

  it('word 通常（word_records）: useWords の全フィールド（segStats 含む）が一致する', () => {
    // useWords.js の record 実フィールド一式。
    const rec = {
      source: 'word',
      seed: 777,
      endCondition: EC,
      level: 3,
      theme: '日常',
      mode: 'en',
      speed: 300,
      keys: 200,
      mistakes: 2,
      accuracy: 0.99,
      correctCount: 30,
      seconds: 40,
      segStats: SEG_STATS,
      date: '2026/7/9 9:22:10',
    }
    saveWordRecordDb(db, rec)
    expect(onlyRecord(loadWordRecordsDb(db))).toEqual(rec)
  })

  it('word クイズ（word_records）: useWordQuiz の全フィールド（correct/correctCount/words 含む）が一致する', () => {
    // useWordQuiz.js の record 実フィールド一式。
    const rec = {
      source: 'word',
      seed: 42,
      endCondition: EC,
      level: 2,
      theme: 'ビジネス',
      mode: 'ja',
      keys: 150,
      speed: 280,
      correct: 28,
      correctCount: 25,
      words: 30,
      mistakes: 4,
      accuracy: 0.93,
      seconds: 55,
      segStats: SEG_STATS,
      date: '2026/7/9 9:22:10',
    }
    saveWordRecordDb(db, rec)
    expect(onlyRecord(loadWordRecordsDb(db))).toEqual(rec)
  })

  it('dict クイズ（dict_records）: useDictQuiz の全フィールド（source:"dict"・mode:kind）が一致する', () => {
    // useDictQuiz.js の record 実フィールド一式（word クイズと同形・source/mode が違う）。
    const rec = {
      source: 'dict',
      seed: 99,
      endCondition: EC,
      level: 4,
      theme: '日常',
      mode: 'def', // kind（説明4択など）
      keys: 120,
      speed: 260,
      correct: 20,
      correctCount: 18,
      words: 20,
      mistakes: 2,
      accuracy: 0.95,
      seconds: 48,
      segStats: SEG_STATS,
      date: '2026/7/9 9:22:10',
    }
    saveDictRecordDb(db, rec)
    expect(onlyRecord(loadDictRecordsDb(db))).toEqual(rec)
  })

  it('story（story_records）: useStory の全フィールド（choices/segStats 含む）が一致する', () => {
    // useStory.js の record 実フィールド一式（seed/level・endCondition は持たない）。
    const rec = {
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
      date: '2026/7/9 9:22:10',
    }
    saveStoryRecordDb(db, 'climbing', rec)
    expect(loadStoryRecordsDb(db, 'climbing')[0]).toEqual(rec)
  })

  it('item_stats: recordItemStatDb の全フィールド（count/keys/mistakes/ms）が一致する', () => {
    // itemStatsDb.js の1件記録。初回は count=1 で {count,keys,mistakes,ms} が復元される。
    const id = 'w:en:reserve'
    recordItemStatDb(db, id, { keys: 7, mistakes: 1, ms: 200 })
    expect(loadItemStatsDb(db)[id]).toEqual({ count: 1, keys: 7, mistakes: 1, ms: 200 })
  })
})
