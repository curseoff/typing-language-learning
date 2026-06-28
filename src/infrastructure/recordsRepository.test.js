// @vitest-environment jsdom
// マラソン記録の永続化（v2→v3 移行・破損ガード・rankInsert 連携）の単体テスト。
import { describe, it, expect, beforeEach } from 'vitest'
import { loadRecords, saveRecord } from './recordsRepository.js'
import { recKey, MAX_RECORDS } from '../domain/records/ranking.js'

const STORAGE_KEY = 'typing-records-v3'
const OLD_STORAGE_KEY = 'typing-records-v2'

describe('infrastructure/recordsRepository', () => {
  beforeEach(() => localStorage.clear())

  it('未保存なら空オブジェクトを返す', () => {
    expect(loadRecords()).toEqual({})
  })

  it('v3 の正常な object をそのまま読み戻す', () => {
    const data = { [recKey('both', 1)]: [{ keys: 30, mistakes: 0 }] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    expect(loadRecords()).toEqual(data)
  })

  it('v3 が無く v2(モード別) があればランク1キーへ移行して返す', () => {
    localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify({ home: [{ keys: 5 }] }))
    expect(loadRecords()).toEqual({ [recKey('home', 1)]: [{ keys: 5 }] })
  })

  it('v3 が配列など object でなければ v2 を見る（!Array.isArray ガード）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]))
    localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify({ both: [{ keys: 9 }] }))
    expect(loadRecords()).toEqual({ [recKey('both', 1)]: [{ keys: 9 }] })
  })

  it('v3 が破損 JSON でも catch して空オブジェクトを返す', () => {
    localStorage.setItem(STORAGE_KEY, '{')
    expect(loadRecords()).toEqual({})
  })

  it('saveRecord はキー生成＋rankInsert で保存し、loadRecords で読み戻せる', () => {
    const record = { mode: 'both', rank: 1, keys: 50, mistakes: 1 }
    const all = saveRecord(record)
    const key = recKey('both', 1)
    expect(all[key]).toContainEqual(record)
    expect(loadRecords()[key]).toContainEqual(record)
  })

  it('saveRecord は keys 多い順・同数ミス少順に並び、MAX_RECORDS で打ち切る', () => {
    const key = recKey('both', 1)
    // keys 昇順に MAX_RECORDS+1 件を保存（最小 keys=1 が溢れる想定）
    for (let i = 1; i <= MAX_RECORDS + 1; i++) {
      saveRecord({ mode: 'both', rank: 1, keys: i, mistakes: 0 })
    }
    const list = loadRecords()[key]
    expect(list).toHaveLength(MAX_RECORDS)
    // keys 降順
    expect(list.map((r) => r.keys)).toEqual([...list.map((r) => r.keys)].sort((a, b) => b - a))
    // 最小 keys=1 は溢れている
    expect(list.some((r) => r.keys === 1)).toBe(false)
    expect(list[0].keys).toBe(MAX_RECORDS + 1)
  })

  it('saveRecord は同数 keys ならミスの少ない方を上位にする', () => {
    const key = recKey('both', 1)
    saveRecord({ mode: 'both', rank: 1, keys: 20, mistakes: 5 })
    saveRecord({ mode: 'both', rank: 1, keys: 20, mistakes: 1 })
    const list = loadRecords()[key]
    expect(list[0].mistakes).toBe(1)
    expect(list[1].mistakes).toBe(5)
  })

  it('saveRecord は source/theme を含むキーで分けて保存する', () => {
    const all = saveRecord({ mode: 'q', rank: 1, source: 'wsent', theme: '旅行', keys: 10 })
    const key = recKey('q', 1, 'wsent', '旅行')
    expect(all[key]).toHaveLength(1)
  })
})
