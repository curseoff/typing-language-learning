// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
// #266 Phase3a: 起動時メモリ像の組み立てと save のメモリ側適用（純関数）。
// coder が後で Green にする src/application/persist/memoryStore.js を対象にする。
// apply* は「現行 localStorage リポジトリと同じ最終結果」でなければならない
// （同じ domain 関数 recKey/rankInsert/compareRecords 等を再利用する前提）。
import {
  buildImage,
  applySaveRecord,
  applySaveWordRecord,
  applySaveDictRecord,
  applyRecordItemStat,
  applySaveStoryRecord,
  applySaveFound,
} from './memoryStore.js'
import { recKey } from '../../domain/records/ranking.js'
import { loadRecords, saveRecord } from '../../infrastructure/recordsRepository.js'
import { loadWordRecords, saveWordRecord } from '../../infrastructure/wordsRepository.js'
import { loadDictRecords, saveDictRecord } from '../../infrastructure/dictRepository.js'
import { loadItemStats, recordItemStat, itemId } from '../../infrastructure/itemStatsRepository.js'
import { loadAllStoryRecords, saveStoryRecord } from '../../infrastructure/storyRepository.js'

beforeEach(() => localStorage.clear())

// records: apply* を record 列で畳み込む。
const foldRecords = (list) => list.reduce((m, r) => applySaveRecord(m, r), {})
// records: 現行 localStorage リポジトリで同じ列を流した最終像。
const oracleRecords = (list) => {
  localStorage.clear()
  for (const r of list) saveRecord(r)
  return loadRecords()
}

describe('buildImage（6マップを束ね、欠損は {} に正規化）', () => {
  it('全欠損なら全て空マップの像', () => {
    expect(buildImage({})).toEqual({
      records: {},
      wordRecords: {},
      dictRecords: {},
      itemStats: {},
      storyFound: {},
      storyRecords: {},
    })
  })

  it('渡したマップはそのまま、欠損枠だけ {} になる', () => {
    const records = { both__r1: [{ keys: 10 }] }
    const itemStats = { 'w:en:reserve': { count: 1, keys: 5, mistakes: 0, ms: 100 } }
    const img = buildImage({ records, itemStats })
    expect(img.records).toEqual(records)
    expect(img.itemStats).toEqual(itemStats)
    expect(img.wordRecords).toEqual({})
    expect(img.dictRecords).toEqual({})
    expect(img.storyFound).toEqual({})
    expect(img.storyRecords).toEqual({})
  })

  it('undefined 要素は {} に正規化する', () => {
    const img = buildImage({ records: undefined, storyFound: undefined })
    expect(img.records).toEqual({})
    expect(img.storyFound).toEqual({})
  })
})

describe('applySaveRecord（マラソン記録・現行 recordsRepository と同値）', () => {
  it('入力マップを破壊せず、新しいトップレベル参照を返す（非破壊）', () => {
    const key = recKey('both', 1)
    const before = { [key]: [{ keys: 10 }] }
    const snapshot = JSON.parse(JSON.stringify(before))
    const after = applySaveRecord(before, { mode: 'both', rank: 1, keys: 20 })

    expect(before).toEqual(snapshot) // 入力不変
    expect(after).not.toBe(before) // 新参照
    expect(after[key]).toHaveLength(2)
  })

  it('theme 無し record はキーに theme タグが付かず、記録に theme が無い', () => {
    const out = applySaveRecord({}, { mode: 'both', rank: 1, keys: 30 })
    const key = recKey('both', 1)
    expect(key).toBe('both__r1')
    expect(out[key][0]).not.toHaveProperty('theme')
  })

  it('endCondition time60（既定）はタグ無しキー・time30 は別キーに分かれる', () => {
    const r60 = { mode: 'both', rank: 1, keys: 10, endCondition: { kind: 'time', value: 60 } }
    const r30 = { mode: 'both', rank: 1, keys: 10, endCondition: { kind: 'time', value: 30 } }
    const out = applySaveRecord(applySaveRecord({}, r60), r30)
    const key60 = recKey('both', 1, 'sentence', undefined, { kind: 'time', value: 60 })
    const key30 = recKey('both', 1, 'sentence', undefined, { kind: 'time', value: 30 })
    expect(key60).toBe('both__r1') // time60 はタグ無し＝従来キー
    expect(key30).not.toBe(key60)
    expect(out[key60]).toHaveLength(1)
    expect(out[key30]).toHaveLength(1)
  })

  it('同キー16件でも上位15件（compareRecords 順）に絞る', () => {
    const list = Array.from({ length: 16 }, (_, i) => ({
      mode: 'both',
      rank: 1,
      keys: i + 1, // keys 降順で上位
      mistakes: 0,
    }))
    const out = foldRecords(list)
    const key = recKey('both', 1)
    expect(out[key]).toHaveLength(15)
    expect(out[key][0].keys).toBe(16) // 最多 keys が先頭
    expect(out[key][14].keys).toBe(2) // 最少(1)は溢れる
  })

  it('空から畳み込んだ最終像が現行 saveRecord/loadRecords と deepEqual（オラクル同値）', () => {
    const list = [
      { mode: 'both', rank: 1, keys: 100, mistakes: 0 },
      { mode: 'both', rank: 1, keys: 50, mistakes: 2 },
      { mode: 'both', rank: 2, keys: 80, mistakes: 1 },
      { mode: 'sentence', rank: 1, source: 'wsent', theme: '旅行', keys: 40, mistakes: 0 },
      {
        mode: 'both',
        rank: 1,
        keys: 70,
        mistakes: 1,
        endCondition: { kind: 'time', value: 30 },
      },
    ]
    expect(foldRecords(list)).toEqual(oracleRecords(list))
  })
})

describe('applySaveWordRecord（単語記録・現行 wordsRepository と同値）', () => {
  const fold = (list) => list.reduce((m, r) => applySaveWordRecord(m, r), {})
  const oracle = (list) => {
    localStorage.clear()
    for (const r of list) saveWordRecord(r)
    return loadWordRecords()
  }

  it('クイズ記録と通常記録を混在させても現行 saveWordRecord と同値', () => {
    const list = [
      { level: 1, theme: 'すべて', mode: 'quiz-en', correct: 5, words: 30, keys: 20, mistakes: 1 },
      { level: 1, theme: 'すべて', mode: 'quiz-en', correct: 3, words: 30, keys: 25, mistakes: 0 },
      { level: 2, theme: '旅行', mode: 'en', keys: 40, mistakes: 2 },
    ]
    expect(fold(list)).toEqual(oracle(list))
  })

  it('入力マップを破壊しない（非破壊）', () => {
    const before = { L1__すべて__en: [{ keys: 5 }] }
    const snapshot = JSON.parse(JSON.stringify(before))
    applySaveWordRecord(before, { level: 1, theme: 'すべて', mode: 'en', keys: 10 })
    expect(before).toEqual(snapshot)
  })
})

describe('applySaveDictRecord（英英記録・現行 dictRepository と同値）', () => {
  const fold = (list) => list.reduce((m, r) => applySaveDictRecord(m, r), {})
  const oracle = (list) => {
    localStorage.clear()
    for (const r of list) saveDictRecord(r)
    return loadDictRecords()
  }

  it('クイズ記録と通常記録を混在させても現行 saveDictRecord と同値', () => {
    const list = [
      { level: 1, theme: 'すべて', mode: 'quiz', correct: 10, words: 20, keys: 30, mistakes: 0 },
      { level: 1, theme: 'すべて', mode: 'quiz', correct: 8, words: 20, keys: 35, mistakes: 1 },
      { level: 3, theme: 'ビジネス', mode: 'ja', keys: 50, mistakes: 3 },
    ]
    expect(fold(list)).toEqual(oracle(list))
  })
})

describe('applyRecordItemStat（問題別累積・現行 itemStatsRepository と同値）', () => {
  it('新規 id は count:1 で keys/mistakes/ms を設定する', () => {
    const id = itemId('words', 'en', 'reserve')
    const out = applyRecordItemStat({}, id, { keys: 10, mistakes: 1, ms: 200 })
    expect(out[id]).toEqual({ count: 1, keys: 10, mistakes: 1, ms: 200 })
  })

  it('同 id を2回適用すると count:2 で各値が加算される', () => {
    const id = itemId('words', 'en', 'reserve')
    const once = applyRecordItemStat({}, id, { keys: 10, mistakes: 1, ms: 200 })
    const twice = applyRecordItemStat(once, id, { keys: 4, mistakes: 2, ms: 50 })
    expect(twice[id]).toEqual({ count: 2, keys: 14, mistakes: 3, ms: 250 })
  })

  it("id に : を含んでもそのままキーにする（文モードの id）", () => {
    const id = "s:both:I go to school: today."
    const out = applyRecordItemStat({}, id, { keys: 20, mistakes: 0, ms: 300 })
    expect(out[id]).toEqual({ count: 1, keys: 20, mistakes: 0, ms: 300 })
  })

  it('入力マップを破壊しない（非破壊）', () => {
    const id = itemId('words', 'en', 'reserve')
    const before = { [id]: { count: 1, keys: 10, mistakes: 1, ms: 200 } }
    const snapshot = JSON.parse(JSON.stringify(before))
    const after = applyRecordItemStat(before, id, { keys: 1, mistakes: 0, ms: 1 })
    expect(before).toEqual(snapshot)
    expect(after).not.toBe(before)
  })

  it('連続適用の最終像が現行 recordItemStat と deepEqual（オラクル同値）', () => {
    const ops = [
      [itemId('words', 'en', 'reserve'), { keys: 10, mistakes: 1, ms: 200 }],
      [itemId('words', 'en', 'reserve'), { keys: 4, mistakes: 2, ms: 50 }],
      ["s:both:I go to school: today.", { keys: 20, mistakes: 0, ms: 300 }],
    ]
    const fold = ops.reduce((m, [id, delta]) => applyRecordItemStat(m, id, delta), {})

    localStorage.clear()
    for (const [id, delta] of ops) recordItemStat(id, delta)
    expect(fold).toEqual(loadItemStats())
  })
})

describe('applySaveFound（物語の発見エンド・発見順を保持）', () => {
  it('storyId 単位で ids をそのまま格納し、追加時も順序を保つ', () => {
    const first = applySaveFound({}, 'travel', ['a', 'b'])
    expect(first.travel).toEqual(['a', 'b'])
    const second = applySaveFound(first, 'travel', ['a', 'b', 'c'])
    expect(second.travel).toEqual(['a', 'b', 'c'])
  })

  it('入力マップを破壊しない（非破壊）', () => {
    const before = { travel: ['a'] }
    const snapshot = JSON.parse(JSON.stringify(before))
    const after = applySaveFound(before, 'climbing', ['x'])
    expect(before).toEqual(snapshot)
    expect(after).not.toBe(before)
    expect(after.travel).toEqual(['a'])
    expect(after.climbing).toEqual(['x'])
  })
})

describe('applySaveStoryRecord（物語記録・現行 storyRepository と同値）', () => {
  const fold = (ops) =>
    ops.reduce((m, [storyId, record]) => applySaveStoryRecord(m, storyId, record), {})
  const oracle = (ops) => {
    localStorage.clear()
    for (const [storyId, record] of ops) saveStoryRecord(storyId, record)
    return loadAllStoryRecords()
  }

  it('storyRecKey 単位で rankInsert 順に束ねる（オラクル同値・loadAllStoryRecords）', () => {
    const ops = [
      ['travel', { source: 'story', storyId: 'travel', keys: 50, mistakes: 1 }],
      ['travel', { source: 'story', storyId: 'travel', keys: 80, mistakes: 0 }],
      [
        'climbing',
        {
          source: 'story',
          storyId: 'climbing',
          keys: 30,
          mistakes: 2,
          endCondition: { kind: 'time', value: 30 },
        },
      ],
    ]
    expect(fold(ops)).toEqual(oracle(ops))
  })

  it('入力マップを破壊しない（非破壊）', () => {
    const before = {}
    const after = applySaveStoryRecord(before, 'travel', {
      source: 'story',
      storyId: 'travel',
      keys: 10,
    })
    expect(before).toEqual({})
    expect(after).not.toBe(before)
  })
})
