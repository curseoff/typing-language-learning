import { describe, it, expect } from 'vitest'
import {
  newCard,
  review,
  isDue,
  buildQueue,
  summarize,
  clozeShown,
  INTERVALS,
  MAX_BOX,
} from './srs.js'

describe('srs', () => {
  it('正解で box が上がり間隔が延びる', () => {
    let c = newCard()
    expect(c.box).toBe(0)
    c = review(c, true, 100) // box1, due=100+1
    expect(c.box).toBe(1)
    expect(c.due).toBe(100 + INTERVALS[1])
    expect(c.reps).toBe(1)
    c = review(c, true, 101) // box2
    expect(c.box).toBe(2)
    expect(c.due).toBe(101 + INTERVALS[2])
  })

  it('不正解で box1・当日に戻り lapses が増える', () => {
    let c = review(newCard(), true, 0) // box1
    c = review(c, true, 1) // box2
    c = review(c, false, 10) // ミス
    expect(c.box).toBe(1)
    expect(c.due).toBe(10)
    expect(c.lapses).toBe(1)
  })

  it('box は MAX_BOX で頭打ち', () => {
    let c = newCard()
    for (let i = 0; i < 20; i++) c = review(c, true, i)
    expect(c.box).toBe(MAX_BOX)
  })

  it('isDue: 未学習(srs無し)も due 扱い', () => {
    expect(isDue(undefined, 5)).toBe(true)
    expect(isDue({ due: 5 }, 5)).toBe(true)
    expect(isDue({ due: 6 }, 5)).toBe(false)
  })

  it('buildQueue: 期限到来の既習と新規(上限まで)を返す', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const srs = { a: { due: 3 }, b: { due: 9 }, c: { due: 5 } } // d,e は新規
    const q = buildQueue(ids, srs, 5, { newLimit: 1 })
    expect(q.reviews).toEqual(['a', 'c']) // due<=5
    expect(q.news).toEqual(['d']) // 上限1
  })

  it('clozeShown: box が高いほど伏せ字が増え、頭文字は残る', () => {
    const word = 'review'
    const shownNew = clozeShown(word, 0, word) // 新規
    const shownMid = clozeShown(word, 3, word)
    const shownMastered = clozeShown(word, MAX_BOX, word) // 完全習熟
    const countShown = (a) => a.filter(Boolean).length
    expect(shownNew[0]).toBe(true) // 頭文字は見せる
    expect(countShown(shownNew)).toBeGreaterThan(countShown(shownMid)) // 習熟で見せる数が減る
    expect(shownMastered.every((v) => v === false)).toBe(true) // 完全習熟は全伏せ
  })

  it('clozeShown: 同じ seed なら毎回同じ（描画でブレない）', () => {
    expect(clozeShown('apple', 2, 'apple')).toEqual(clozeShown('apple', 2, 'apple'))
  })

  it('summarize: 学習済/期限/未学習を数える', () => {
    const ids = ['a', 'b', 'c']
    const srs = { a: { due: 1 }, b: { due: 9 } }
    const s = summarize(ids, srs, 5)
    expect(s).toEqual({ learned: 2, due: 1, total: 3, fresh: 1 })
  })
})
