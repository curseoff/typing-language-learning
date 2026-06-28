// @vitest-environment jsdom
// 英英辞典の記録の永続化（キー形式・object ガード・破損ガード・keys降順/同数ミス昇順ソート）の単体テスト。
import { describe, it, expect, beforeEach } from 'vitest'
import { dictRecKey, loadDictRecords, saveDictRecord } from './dictRepository.js'
import { MAX_RECORDS } from '../domain/records/ranking.js'

const STORAGE_KEY = 'dict-records-v1'

describe('infrastructure/dictRepository', () => {
  beforeEach(() => localStorage.clear())

  it('dictRecKey は L{level}__{theme}__{mode} 形式', () => {
    expect(dictRecKey(1, 'すべて', 'quiz')).toBe('L1__すべて__quiz')
  })

  it('未保存なら空オブジェクトを返す', () => {
    expect(loadDictRecords()).toEqual({})
  })

  it('正常な object をそのまま読み戻す', () => {
    const data = { 'L1__すべて__quiz': [{ keys: 10 }] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    expect(loadDictRecords()).toEqual(data)
  })

  it('配列が入っていたら空オブジェクトを返す（!Array.isArray ガード）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2]))
    expect(loadDictRecords()).toEqual({})
  })

  it('破損 JSON でも catch して空オブジェクトを返す', () => {
    localStorage.setItem(STORAGE_KEY, '{bad')
    expect(loadDictRecords()).toEqual({})
  })

  it('saveDictRecord はキー生成して保存し、読み戻せる', () => {
    const record = { level: 1, theme: 'すべて', mode: 'quiz', keys: 5, mistakes: 0 }
    const all = saveDictRecord(record)
    const key = dictRecKey(1, 'すべて', 'quiz')
    expect(all[key]).toContainEqual(record)
    expect(loadDictRecords()[key]).toContainEqual(record)
  })

  it('saveDictRecord は keys 降順・同数ミス昇順に並べる', () => {
    const base = { level: 1, theme: 'すべて', mode: 'quiz' }
    saveDictRecord({ ...base, keys: 10, mistakes: 0 })
    saveDictRecord({ ...base, keys: 30, mistakes: 0 })
    saveDictRecord({ ...base, keys: 30, mistakes: 2 })
    const list = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')]
    expect(list.map((r) => [r.keys, r.mistakes])).toEqual([
      [30, 0],
      [30, 2],
      [10, 0],
    ])
  })

  it('saveDictRecord は MAX_RECORDS 件で打ち切る', () => {
    const base = { level: 1, theme: 'すべて', mode: 'quiz' }
    for (let i = 1; i <= MAX_RECORDS + 3; i++) saveDictRecord({ ...base, keys: i })
    const list = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')]
    expect(list).toHaveLength(MAX_RECORDS)
    expect(list[0].keys).toBe(MAX_RECORDS + 3)
  })

  it('saveDictRecord は既存キーへ追記する', () => {
    const base = { level: 2, theme: '旅行', mode: 'quiz' }
    saveDictRecord({ ...base, keys: 1 })
    const all = saveDictRecord({ ...base, keys: 2 })
    expect(all[dictRecKey(2, '旅行', 'quiz')]).toHaveLength(2)
  })
})
