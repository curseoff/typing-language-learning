// @vitest-environment jsdom
// 問題ごとの累積記録（id 形式・object ガード・破損ガード・加算・setItem 失敗時の無視）の単体テスト。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { itemId, loadItemStats, recordItemStat } from './itemStatsRepository.js'

const STORAGE_KEY = 'item-stats-v1'

describe('infrastructure/itemStatsRepository', () => {
  beforeEach(() => localStorage.clear())

  it('itemId は type:mode:key 形式', () => {
    expect(itemId('w', 'en', 'reserve')).toBe('w:en:reserve')
  })

  it('未保存なら空オブジェクトを返す', () => {
    expect(loadItemStats()).toEqual({})
  })

  it('正常な object をそのまま読み戻す', () => {
    const data = { 'w:en:reserve': { count: 1, keys: 7, mistakes: 0, ms: 100 } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    expect(loadItemStats()).toEqual(data)
  })

  it('配列が入っていたら空オブジェクトを返す（!Array.isArray ガード）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1]))
    expect(loadItemStats()).toEqual({})
  })

  it('破損 JSON でも catch して空オブジェクトを返す', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    expect(loadItemStats()).toEqual({})
  })

  it('recordItemStat は新規 id を count=1 から初期化する', () => {
    const all = recordItemStat('w:en:reserve', { keys: 7, mistakes: 1, ms: 200 })
    expect(all['w:en:reserve']).toEqual({ count: 1, keys: 7, mistakes: 1, ms: 200 })
    expect(loadItemStats()['w:en:reserve']).toEqual({ count: 1, keys: 7, mistakes: 1, ms: 200 })
  })

  it('recordItemStat は既存 id へ count/keys/mistakes/ms を加算する', () => {
    recordItemStat('d:ja:hotel', { keys: 5, mistakes: 1, ms: 100 })
    const all = recordItemStat('d:ja:hotel', { keys: 3, mistakes: 2, ms: 50 })
    expect(all['d:ja:hotel']).toEqual({ count: 2, keys: 8, mistakes: 3, ms: 150 })
  })

  it('setItem が throw しても例外を投げず all を返す（プライベートモード等）', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    try {
      let all
      expect(() => {
        all = recordItemStat('s:both:I go.', { keys: 4, mistakes: 0, ms: 80 })
      }).not.toThrow()
      expect(all['s:both:I go.']).toEqual({ count: 1, keys: 4, mistakes: 0, ms: 80 })
    } finally {
      spy.mockRestore()
    }
  })
})
