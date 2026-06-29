// @vitest-environment jsdom
// 単語問題の記録の永続化（キー形式・object ガード・破損ガード・keys降順/同数ミス昇順ソート）の単体テスト。
import { describe, it, expect, beforeEach } from 'vitest'
import { wordRecKey, loadWordRecords, saveWordRecord } from './wordsRepository.js'
import { MAX_RECORDS } from '../domain/records/ranking.js'

const STORAGE_KEY = 'word-records-v2'

describe('infrastructure/wordsRepository', () => {
  beforeEach(() => localStorage.clear())

  it('wordRecKey は L{level}__{theme}__{mode} 形式', () => {
    expect(wordRecKey(3, 'ビジネス', 'quiz-en')).toBe('L3__ビジネス__quiz-en')
  })

  it('未保存なら空オブジェクトを返す', () => {
    expect(loadWordRecords()).toEqual({})
  })

  it('正常な object をそのまま読み戻す', () => {
    const data = { 'L1__すべて__quiz-en': [{ keys: 8 }] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    expect(loadWordRecords()).toEqual(data)
  })

  it('配列が入っていたら空オブジェクトを返す（!Array.isArray ガード）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2]))
    expect(loadWordRecords()).toEqual({})
  })

  it('破損 JSON でも catch して空オブジェクトを返す', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect(loadWordRecords()).toEqual({})
  })

  it('saveWordRecord はキー生成して保存し、読み戻せる', () => {
    const record = { level: 1, theme: 'すべて', mode: 'quiz-en', keys: 5, mistakes: 0 }
    const all = saveWordRecord(record)
    const key = wordRecKey(1, 'すべて', 'quiz-en')
    expect(all[key]).toContainEqual(record)
    expect(loadWordRecords()[key]).toContainEqual(record)
  })

  it('saveWordRecord は keys 降順・同数ミス昇順に並べる', () => {
    const base = { level: 1, theme: 'すべて', mode: 'quiz-en' }
    saveWordRecord({ ...base, keys: 10, mistakes: 0 })
    saveWordRecord({ ...base, keys: 30, mistakes: 0 })
    saveWordRecord({ ...base, keys: 30, mistakes: 2 })
    const list = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')]
    expect(list.map((r) => [r.keys, r.mistakes])).toEqual([
      [30, 0],
      [30, 2],
      [10, 0],
    ])
  })

  it('saveWordRecord は MAX_RECORDS 件で打ち切る', () => {
    const base = { level: 1, theme: 'すべて', mode: 'quiz-en' }
    for (let i = 1; i <= MAX_RECORDS + 3; i++) saveWordRecord({ ...base, keys: i })
    const list = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')]
    expect(list).toHaveLength(MAX_RECORDS)
    expect(list[0].keys).toBe(MAX_RECORDS + 3)
  })

  it('saveWordRecord は既存キーへ追記する', () => {
    const base = { level: 2, theme: '旅行', mode: 'quiz-ja' }
    saveWordRecord({ ...base, keys: 1 })
    const all = saveWordRecord({ ...base, keys: 2 })
    expect(all[wordRecKey(2, '旅行', 'quiz-ja')]).toHaveLength(2)
  })
})
