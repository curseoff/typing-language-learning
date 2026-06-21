import { describe, it, expect } from 'vitest'
import { rankInsert, recKey, MAX_RECORDS } from './ranking.js'

describe('ranking', () => {
  it('recKey は mode と rank を合成する', () => {
    expect(recKey('both', 3)).toBe('both__r3')
  })

  it('速い順に並べ、最大件数で切る', () => {
    const list = rankInsert([{ speed: 300 }, { speed: 500 }], { speed: 400 })
    expect(list.map((r) => r.speed)).toEqual([500, 400, 300])
  })

  it('MAX_RECORDS を超えない', () => {
    let list = []
    for (let i = 0; i < MAX_RECORDS + 10; i++) list = rankInsert(list, { speed: i })
    expect(list.length).toBe(MAX_RECORDS)
    expect(list[0].speed).toBe(MAX_RECORDS + 9) // 最速が先頭
  })
})
