// @vitest-environment jsdom
// 物語の永続化（発見エンドの round-trip・parseArray ガード・レガシー移行・rankInsert 連携）の単体テスト。
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadFound,
  saveFound,
  loadStoryRecords,
  saveStoryRecord,
} from './storyRepository.js'
import { MAX_RECORDS } from '../domain/records/ranking.js'

const foundKey = (id) => `story-endings-v1-${id}`
const recordsKey = (id) => `story-records-v1-${id}`
const LEGACY_FOUND_KEY = 'story-endings-v1'
const LEGACY_RECORDS_KEY = 'story-records-v1'

describe('infrastructure/storyRepository', () => {
  beforeEach(() => localStorage.clear())

  it('saveFound→loadFound で発見エンドを round-trip できる', () => {
    saveFound('climbing', ['a', 'b'])
    expect(loadFound('climbing')).toEqual(['a', 'b'])
  })

  it('parseArray: 非配列(object)が入っていたら空配列を返す', () => {
    localStorage.setItem(foundKey('x'), '{}')
    expect(loadFound('x')).toEqual([])
  })

  it('parseArray: 破損 JSON でも空配列を返す', () => {
    localStorage.setItem(foundKey('y'), '[bad')
    expect(loadFound('y')).toEqual([])
  })

  it('未保存の物語記録は空配列を返す', () => {
    expect(loadStoryRecords('climbing')).toEqual([])
  })

  // --- レガシー移行（travel のみ）---
  it('migrateLegacy: travel の legacy(found) があり新キー無し→loadFound で内容が返り legacy が消える', () => {
    localStorage.setItem(LEGACY_FOUND_KEY, JSON.stringify(['old']))
    expect(loadFound('travel')).toEqual(['old'])
    expect(localStorage.getItem(LEGACY_FOUND_KEY)).toBeNull()
    // 新キーへコピーされている
    expect(JSON.parse(localStorage.getItem(foundKey('travel')))).toEqual(['old'])
  })

  it('migrateLegacy: travel の legacy(records) があり新キー無し→loadStoryRecords で内容が返り legacy が消える', () => {
    localStorage.setItem(LEGACY_RECORDS_KEY, JSON.stringify([{ keys: 3 }]))
    expect(loadStoryRecords('travel')).toEqual([{ keys: 3 }])
    expect(localStorage.getItem(LEGACY_RECORDS_KEY)).toBeNull()
  })

  it('migrateLegacy: 新キーが既存なら legacy で上書きせず（新キー優先）legacy だけ消す', () => {
    localStorage.setItem(foundKey('travel'), JSON.stringify(['new']))
    localStorage.setItem(LEGACY_FOUND_KEY, JSON.stringify(['old']))
    expect(loadFound('travel')).toEqual(['new'])
    expect(localStorage.getItem(LEGACY_FOUND_KEY)).toBeNull()
  })

  it('migrateLegacy: travel 以外（climbing）は legacy を無視する（no-op）', () => {
    localStorage.setItem(LEGACY_FOUND_KEY, JSON.stringify(['old']))
    expect(loadFound('climbing')).toEqual([])
    // legacy は消されない
    expect(localStorage.getItem(LEGACY_FOUND_KEY)).not.toBeNull()
  })

  it('saveStoryRecord は rankInsert で keys 降順に保存し list を返す', () => {
    saveStoryRecord('climbing', { keys: 10 })
    const list = saveStoryRecord('climbing', { keys: 30 })
    expect(list.map((r) => r.keys)).toEqual([30, 10])
    expect(loadStoryRecords('climbing').map((r) => r.keys)).toEqual([30, 10])
  })

  it('saveStoryRecord は MAX_RECORDS 件で打ち切る', () => {
    let list
    for (let i = 1; i <= MAX_RECORDS + 3; i++) list = saveStoryRecord('climbing', { keys: i })
    expect(list).toHaveLength(MAX_RECORDS)
    expect(list[0].keys).toBe(MAX_RECORDS + 3)
  })
})
