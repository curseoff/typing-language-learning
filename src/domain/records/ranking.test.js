import { describe, it, expect } from 'vitest'
import { rankInsert, recKey, MAX_RECORDS } from './ranking.js'

describe('ranking', () => {
  it('recKey は mode と rank を合成する', () => {
    expect(recKey('both', 3)).toBe('both__r3')
  })

  it('タイピング数(keys)の多い順に並べ、最大件数で切る', () => {
    const list = rankInsert([{ keys: 300 }, { keys: 500 }], { keys: 400 })
    expect(list.map((r) => r.keys)).toEqual([500, 400, 300])
  })

  it('keys 同数はミスの少ない順', () => {
    const list = rankInsert([{ keys: 400, mistakes: 5 }], { keys: 400, mistakes: 2 })
    expect(list.map((r) => r.mistakes)).toEqual([2, 5])
  })

  it('keys が無い古い記録は 0 扱いで末尾に回る', () => {
    const list = rankInsert([{ keys: 100 }], { speed: 999 })
    expect(list[0].keys).toBe(100)
    expect(list[1].keys).toBeUndefined()
  })

  it('MAX_RECORDS を超えない', () => {
    let list = []
    for (let i = 0; i < MAX_RECORDS + 10; i++) list = rankInsert(list, { keys: i })
    expect(list.length).toBe(MAX_RECORDS)
    expect(list[0].keys).toBe(MAX_RECORDS + 9) // 最多が先頭
  })
})
