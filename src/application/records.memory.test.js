// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
// #274 スライス2: 永続化を sqlite 専用へ転換する新契約のうち、非sqlite の既定＝memory モード
// （非永続・メモリ像のみ・localStorage を一切触らない）の振る舞いをロックする Red。
//   - 新設計では backend 既定は 'memory'。memory/sqlite の両モードともメモリ像 image から読み書きし、
//     localStorage 経路（ls*）は撤去される。
//   - 新規 export initMemoryPersistence(initialImage?) で memory モードを確立し、テストの状態リセットにも使う
//     （既存の initSqlitePersistence/initSecondaryPersistence を beforeEach で呼ぶのと同じ流儀）。
//   - 現状 records.js は initMemoryPersistence 未実装＋既定 'local' なので、これらは意図どおり赤になる。
import {
  initMemoryPersistence,
  loadWordRecords,
  saveWordRecord,
  loadDictRecords,
  saveDictRecord,
  loadRecords,
  saveRecord,
  loadItemStats,
  recordItemStat,
  loadStoryRecords,
  loadAllStoryRecords,
  saveStoryRecord,
  loadFound,
  saveFound,
} from './records.js'
import { wordRecKey, dictRecKey, storyRecKey } from '../domain/records/recordKeys.service.js'

// 現状 localStorage をクリアするのは既存流儀（隠れ状態の混入を避ける）。memory モードでは
// そもそも localStorage に触れないことを本ファイルで検証する。
beforeEach(() => {
  localStorage.clear()
})

describe('memory モード（非sqlite の新既定・非永続・メモリ像のみ）', () => {
  describe('空像から開始', () => {
    beforeEach(() => {
      initMemoryPersistence()
    })

    it('initMemoryPersistence() 後、各種 load は空マップ（{}）／空配列（[]）を返す', () => {
      expect(loadWordRecords()).toEqual({})
      expect(loadRecords()).toEqual({})
      expect(loadDictRecords()).toEqual({})
      expect(loadItemStats()).toEqual({})
      expect(loadAllStoryRecords()).toEqual({})
      expect(loadFound('x')).toEqual([])
      expect(loadStoryRecords('travel', 'found')).toEqual([])
    })
  })

  describe('save→load ラウンドトリップ（メモリ像経由）', () => {
    beforeEach(() => {
      initMemoryPersistence()
    })

    it('saveWordRecord の戻り値と後続 loadWordRecords に反映される', () => {
      const rec = { level: 1, theme: 'すべて', mode: 'en', keys: 10, mistakes: 0 }
      const key = wordRecKey(1, 'すべて', 'en')
      const out = saveWordRecord(rec)
      expect(out[key]).toHaveLength(1)
      expect(loadWordRecords()[key]).toHaveLength(1)
    })

    it('saveDictRecord がメモリ像に反映される', () => {
      const rec = { level: 1, theme: 'すべて', mode: 'en', keys: 5, mistakes: 0 }
      const key = dictRecKey(1, 'すべて', 'en')
      const out = saveDictRecord(rec)
      expect(out[key]).toHaveLength(1)
      expect(loadDictRecords()[key]).toHaveLength(1)
    })

    it('saveRecord（マラソン）がメモリ像に反映される', () => {
      const rec = { mode: 'both', rank: 1, keys: 20, mistakes: 0 }
      const out = saveRecord(rec)
      expect(Object.keys(out)).toHaveLength(1)
      expect(Object.keys(loadRecords())).toHaveLength(1)
    })

    it('saveStoryRecord が storyRecKey 単位でメモリ像に反映される', () => {
      const rec = { endCondition: 'found', keys: 10, mistakes: 0 }
      const key = storyRecKey('travel', 'found')
      const out = saveStoryRecord('travel', rec)
      expect(out).toHaveLength(1)
      expect(loadStoryRecords('travel', 'found')).toHaveLength(1)
      expect(loadAllStoryRecords()[key]).toHaveLength(1)
    })

    it('saveFound / loadFound が storyId 単位で往復する', () => {
      saveFound('travel', ['a', 'b'])
      expect(loadFound('travel')).toEqual(['a', 'b'])
    })

    it('recordItemStat がメモリ像に累積される', () => {
      const out = recordItemStat('w:en:foo', { keys: 12, mistakes: 1, ms: 3000 })
      expect(out['w:en:foo']).toMatchObject({ count: 1, keys: 12, mistakes: 1, ms: 3000 })
      expect(loadItemStats()['w:en:foo']).toMatchObject({ count: 1 })
    })
  })

  describe('localStorage に書かない（永続化しない証明）', () => {
    it('memory モードで各種 save をしても localStorage は空のまま', () => {
      initMemoryPersistence()
      saveWordRecord({ level: 1, theme: 'すべて', mode: 'en', keys: 10, mistakes: 0 })
      saveDictRecord({ level: 1, theme: 'すべて', mode: 'en', keys: 5, mistakes: 0 })
      saveRecord({ mode: 'both', rank: 1, keys: 20, mistakes: 0 })
      saveStoryRecord('travel', { endCondition: 'found', keys: 10, mistakes: 0 })
      saveFound('travel', ['a', 'b'])
      recordItemStat('w:en:foo', { keys: 12, mistakes: 1, ms: 3000 })
      expect(localStorage.length).toBe(0)
    })
  })

  describe('非永続（リロード相当で消える）', () => {
    it('save 後に initMemoryPersistence() を呼び直すと像が空に戻る（隠れた永続化が無い）', () => {
      initMemoryPersistence()
      saveWordRecord({ level: 1, theme: 'すべて', mode: 'en', keys: 10, mistakes: 0 })
      expect(Object.keys(loadWordRecords())).toHaveLength(1)
      // 再初期化＝リロード相当。localStorage 由来の復元が無いので空に戻る。
      initMemoryPersistence()
      expect(loadWordRecords()).toEqual({})
    })

    it('initMemoryPersistence(initialImage) を渡すと、その像から開始できる', () => {
      const key = wordRecKey(2, 'すべて', 'ja')
      initMemoryPersistence({ wordRecords: { [key]: [{ level: 2, keys: 99 }] } })
      expect(loadWordRecords()[key]).toHaveLength(1)
    })
  })

  describe('memory 書込みは throw しない（queue===null でも例外を投げない）', () => {
    it('各種 save が例外を投げない', () => {
      initMemoryPersistence()
      expect(() => {
        saveWordRecord({ level: 1, theme: 'すべて', mode: 'en', keys: 10, mistakes: 0 })
        saveDictRecord({ level: 1, theme: 'すべて', mode: 'en', keys: 5, mistakes: 0 })
        saveRecord({ mode: 'both', rank: 1, keys: 20, mistakes: 0 })
        saveStoryRecord('travel', { endCondition: 'found', keys: 10, mistakes: 0 })
        saveFound('travel', ['a', 'b'])
        recordItemStat('w:en:foo', { keys: 12, mistakes: 1, ms: 3000 })
      }).not.toThrow()
    })
  })
})
