import { describe, it, expect, vi, beforeEach } from 'vitest'
// #451 記録の1件削除：ファサード deleteRecordAt の配線テスト。
// 純ロジック（applyDeleteAt／recordGroupOf）は各 spec が担保済み。ここは
// 「1 始まり position の変換・座標特定・安全確認・メモリ像の更新・Worker へのグループ置換」
// という records.service の配線を確認する。
import {
  initSqlitePersistence,
  initSecondaryPersistence,
  consumeSecondaryWriteAttempt,
  deleteRecordAt,
  loadRecords,
  loadWordRecords,
  loadDictRecords,
  loadAllStoryRecords,
} from './records.service.js'
import { recKey } from '../domain/records/ranking.service.js'
import { wordRecKey, dictRecKey, storyRecKey } from '../domain/records/recordKeys.service.js'

// write-queue は exec を microtask で走らせる（fire-and-forget）。tick で吐き切らせてから検証する。
const tick = () => new Promise((r) => setTimeout(r, 0))

// 各 store の代表グループ（キー・3件のランキング）。date は同一性確認に使うので全件違う値にする。
const REC_KEY = recKey('both', 1, 'sentence')
const recs = [
  { mode: 'both', rank: 1, source: 'sentence', keys: 300, date: '2026-07-01' },
  { mode: 'both', rank: 1, source: 'sentence', keys: 200, date: '2026-07-02' },
  { mode: 'both', rank: 1, source: 'sentence', keys: 100, date: '2026-07-03' },
]
const WORD_KEY = wordRecKey(3, '日常', 'en')
const words = [
  { source: 'word', level: 3, theme: '日常', mode: 'en', keys: 90, date: '2026-07-01' },
  { source: 'word', level: 3, theme: '日常', mode: 'en', keys: 80, date: '2026-07-02' },
]
const DICT_KEY = dictRecKey(2, 'ビジネス', 'def')
const dicts = [
  { source: 'dict', level: 2, theme: 'ビジネス', mode: 'def', keys: 70, date: '2026-07-01' },
  { source: 'dict', level: 2, theme: 'ビジネス', mode: 'def', keys: 60, date: '2026-07-02' },
]
const STORY_KEY = storyRecKey('travel')
const stories = [
  { source: 'story', storyId: 'travel', ending: 'good', keys: 50, date: '2026-07-01' },
  { source: 'story', storyId: 'travel', ending: 'bad', keys: 40, date: '2026-07-02' },
]

// 4 store 分を積んだ像で sqlite 主タブを起動する（配列は毎回複製＝テスト間で汚れない）。
const freshImage = () => ({
  records: { [REC_KEY]: recs.map((r) => ({ ...r })) },
  wordRecords: { [WORD_KEY]: words.map((r) => ({ ...r })) },
  dictRecords: { [DICT_KEY]: dicts.map((r) => ({ ...r })) },
  storyRecords: { [STORY_KEY]: stories.map((r) => ({ ...r })) },
})

let save
beforeEach(() => {
  save = vi.fn(() => Promise.resolve())
  initSqlitePersistence({ save }, freshImage())
})

describe('deleteRecordAt（各 store の1件削除）', () => {
  it('records: position=2 で 2 番目だけ消え、Worker へ残り配列でグループ置換を流す', async () => {
    const target = loadRecords()[REC_KEY][1]
    expect(deleteRecordAt(target, 2)).toBe(true)
    expect(loadRecords()[REC_KEY].map((r) => r.keys)).toEqual([300, 100])
    await tick()
    expect(save).toHaveBeenCalledWith('recordsGroup', [target, loadRecords()[REC_KEY]])
  })

  it('word: 先頭（position=1）を消せる', async () => {
    const target = loadWordRecords()[WORD_KEY][0]
    expect(deleteRecordAt(target, 1)).toBe(true)
    expect(loadWordRecords()[WORD_KEY].map((r) => r.keys)).toEqual([80])
    await tick()
    expect(save).toHaveBeenCalledWith('wordGroup', [target, loadWordRecords()[WORD_KEY]])
  })

  it('dict: 末尾（position=length）を消せる', async () => {
    const target = loadDictRecords()[DICT_KEY][1]
    expect(deleteRecordAt(target, 2)).toBe(true)
    expect(loadDictRecords()[DICT_KEY].map((r) => r.keys)).toEqual([70])
    await tick()
    expect(save).toHaveBeenCalledWith('dictGroup', [target, loadDictRecords()[DICT_KEY]])
  })

  it('story: storyId をグループ座標として Worker 引数の先頭に載せる', async () => {
    const target = loadAllStoryRecords()[STORY_KEY][0]
    expect(deleteRecordAt(target, 1)).toBe(true)
    expect(loadAllStoryRecords()[STORY_KEY].map((r) => r.keys)).toEqual([40])
    await tick()
    expect(save).toHaveBeenCalledWith('storyGroup', [
      'travel',
      target,
      loadAllStoryRecords()[STORY_KEY],
    ])
  })

  it('削除後は loadXxx が新しいマップ（新参照）を返す', () => {
    const before = loadRecords()
    deleteRecordAt(before[REC_KEY][0], 1)
    expect(loadRecords()).not.toBe(before)
    expect(before[REC_KEY]).toHaveLength(3) // 元の像は非破壊
  })

  it('最後の1件を消すとキーごと落ちる（空のランキングを画面に出さない）', async () => {
    const key = WORD_KEY
    const first = loadWordRecords()[key][0]
    deleteRecordAt(first, 1)
    const last = loadWordRecords()[key][0]
    expect(deleteRecordAt(last, 1)).toBe(true)
    expect(key in loadWordRecords()).toBe(false)
    await tick()
    // 残り配列は空＝DB 側もグループの行が 1 本も残らない。
    expect(save).toHaveBeenLastCalledWith('wordGroup', [last, []])
  })
})

describe('deleteRecordAt（消さない場合＝書き込みも起こさない）', () => {
  it('position がずれていたら別の記録を巻き込まず false を返す', async () => {
    const before = loadRecords()
    const target = before[REC_KEY][0] // 実際は position=1 の記録
    expect(deleteRecordAt(target, 2)).toBe(false)
    expect(loadRecords()).toBe(before) // 像は不変（参照ごと同じ）
    await tick()
    expect(save).not.toHaveBeenCalled()
  })

  it('範囲外の position では何も起きない', async () => {
    const before = loadRecords()
    expect(deleteRecordAt(before[REC_KEY][0], 0)).toBe(false)
    expect(deleteRecordAt(before[REC_KEY][0], 99)).toBe(false)
    expect(loadRecords()).toBe(before)
    await tick()
    expect(save).not.toHaveBeenCalled()
  })

  it('recordGroupOf が座標を出せない記録は false・像は不変', async () => {
    const before = loadRecords()
    expect(deleteRecordAt({}, 1)).toBe(false)
    expect(deleteRecordAt(null, 1)).toBe(false)
    expect(deleteRecordAt({ source: 'story' }, 1)).toBe(false) // storyId 無し
    expect(loadRecords()).toBe(before)
    await tick()
    expect(save).not.toHaveBeenCalled()
  })

  it('像に該当グループが無ければ false（キー違いで空振りしても書かない）', async () => {
    expect(deleteRecordAt({ mode: 'q', rank: 9, source: 'sentence', date: 'x' }, 1)).toBe(false)
    await tick()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('deleteRecordAt（副タブ＝read-only）', () => {
  it('メモリ像は楽観更新するが Worker へは流さない（既存 writeThrough の分岐）', () => {
    initSecondaryPersistence(freshImage(), { epoch: 3 })
    const target = loadRecords()[REC_KEY][0]
    expect(deleteRecordAt(target, 1)).toBe(true)
    expect(loadRecords()[REC_KEY]).toHaveLength(2) // 当該タブ表示用に楽観更新
    expect(consumeSecondaryWriteAttempt()).toBe(true)
  })
})
