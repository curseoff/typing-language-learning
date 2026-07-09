import { describe, it, expect, vi, beforeEach } from 'vitest'
// #266 Phase3a: ファサードの sqlite 経路（メモリ像から同期読み／write-through）の配線テスト。
// 純ロジック（apply*）は memoryStore.test.js が担保済み。ここは「backend=sqlite 時に
// メモリ像へ即時反映し、更新後マップを同期返却し、Worker へ差分書き込みを流す」配線を確認する。
// initSqlitePersistence を呼ぶとモジュール singleton が sqlite に切り替わる（このファイル内で持続）。
import {
  initSqlitePersistence,
  loadRecords,
  saveRecord,
  loadWordRecords,
  saveWordRecord,
  loadDictRecords,
  saveDictRecord,
  loadItemStats,
  recordItemStat,
  loadStoryRecords,
  loadAllStoryRecords,
  saveStoryRecord,
  loadFound,
  saveFound,
  wordRanking,
  dictRanking,
} from './records.js'
import { recKey } from '../domain/records/ranking.js'
import { wordRecKey, dictRecKey, storyRecKey, itemId } from '../domain/records/recordKeys.js'

let save
// 各テスト前に sqlite バックエンドを空像で有効化する（handle.save は fire-and-forget の受け口）。
beforeEach(() => {
  save = vi.fn(() => Promise.resolve())
  initSqlitePersistence({ save }, {})
})

// write-queue は exec を microtask で走らせる（fire-and-forget）。tick で吐き切らせてから save を検証する。
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('マラソン記録（records）', () => {
  it('空像から読むと {}・save で更新後の全マップを同期返却し Worker へ流す', async () => {
    expect(loadRecords()).toEqual({})
    const record = { mode: 'both', rank: 1, keys: 20, mistakes: 0 }
    const out = saveRecord(record)
    const key = recKey('both', 1)
    expect(out[key]).toHaveLength(1)
    expect(out[key][0].keys).toBe(20)
    expect(loadRecords()).toBe(out) // 以後の読みも更新後像
    await tick()
    expect(save).toHaveBeenCalledWith('records', [record])
  })
})

describe('単語記録（word）', () => {
  it('save でメモリ像へ反映し wordRanking からも引ける', async () => {
    expect(loadWordRecords()).toEqual({})
    const record = { level: 1, theme: 'すべて', mode: 'en', keys: 10, mistakes: 0 }
    const out = saveWordRecord(record)
    const key = wordRecKey(1, 'すべて', 'en')
    expect(out[key]).toHaveLength(1)
    expect(wordRanking(1, 'すべて', 'en')).toHaveLength(1)
    await tick()
    expect(save).toHaveBeenCalledWith('word', [record])
  })
})

describe('英英記録（dict）', () => {
  it('save でメモリ像へ反映し dictRanking からも引ける', async () => {
    expect(loadDictRecords()).toEqual({})
    const record = { level: 1, theme: 'すべて', mode: 'ja', keys: 15, mistakes: 1 }
    const out = saveDictRecord(record)
    const key = dictRecKey(1, 'すべて', 'ja')
    expect(out[key]).toHaveLength(1)
    expect(dictRanking(1, 'すべて', 'ja')).toHaveLength(1)
    await tick()
    expect(save).toHaveBeenCalledWith('dict', [record])
  })
})

describe('問題別統計（item）', () => {
  it('recordItemStat で累積し更新後マップを返す（F-1 集約）', async () => {
    expect(loadItemStats()).toEqual({})
    const id = itemId('w', 'en', 'reserve')
    const out1 = recordItemStat(id, { keys: 10, mistakes: 1, ms: 200 })
    expect(out1[id]).toEqual({ count: 1, keys: 10, mistakes: 1, ms: 200 })
    const out2 = recordItemStat(id, { keys: 4, mistakes: 2, ms: 50 })
    expect(out2[id]).toEqual({ count: 2, keys: 14, mistakes: 3, ms: 250 })
    expect(loadItemStats()).toBe(out2)
    await tick()
    expect(save).toHaveBeenLastCalledWith('item', [id, { keys: 4, mistakes: 2, ms: 50 }])
  })
})

describe('物語記録（story / found）', () => {
  it('saveStoryRecord で当該グループ配列を返し loadStoryRecords/loadAllStoryRecords が一致', async () => {
    expect(loadStoryRecords('travel')).toEqual([])
    const record = { source: 'story', storyId: 'travel', keys: 50, mistakes: 1 }
    const list = saveStoryRecord('travel', record)
    expect(list).toHaveLength(1)
    expect(loadStoryRecords('travel')).toEqual(list)
    const key = storyRecKey('travel')
    expect(loadAllStoryRecords()[key]).toEqual(list)
    await tick()
    expect(save).toHaveBeenCalledWith('story', ['travel', record])
  })

  it('saveFound は void・loadFound はメモリ像から発見順で返す', async () => {
    expect(loadFound('travel')).toEqual([])
    expect(saveFound('travel', ['a', 'b'])).toBeUndefined()
    expect(loadFound('travel')).toEqual(['a', 'b'])
    await tick()
    expect(save).toHaveBeenCalledWith('found', ['travel', ['a', 'b']])
  })
})
