import { describe, it, expect } from 'vitest'
// 未実装モジュール（契約B）。coder が Green にする対象。
import { buildKanaDrill } from './drill.js'
import { mulberry32 } from '../rng.js'

const SET = ['あ', 'か', 'さ', 'た', 'な']

describe('buildKanaDrill（契約B: 行ドリル生成）', () => {
  it('count 個のかな列を返す', () => {
    expect(buildKanaDrill(SET, 10).length).toBe(10)
    expect(buildKanaDrill(SET, 3).length).toBe(3)
  })

  it('count 省略時も既定個数の配列を返す', () => {
    const out = buildKanaDrill(SET)
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBeGreaterThan(0)
  })

  it('全要素が kanaSet に含まれる', () => {
    const out = buildKanaDrill(SET, 50, { rng: mulberry32(1) })
    for (const k of out) expect(SET).toContain(k)
  })

  it('集合が2件以上なら同じかなを連続させない', () => {
    const out = buildKanaDrill(SET, 100, { rng: mulberry32(1) })
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).not.toBe(out[i - 1])
    }
  })

  it('集合が1件なら連続を許容する', () => {
    expect(buildKanaDrill(['あ'], 5)).toEqual(['あ', 'あ', 'あ', 'あ', 'あ'])
  })

  it('同じ seed の rng で同じ列を返す（決定的）', () => {
    const a = buildKanaDrill(SET, 40, { rng: mulberry32(42) })
    const b = buildKanaDrill(SET, 40, { rng: mulberry32(42) })
    expect(a).toEqual(b)
  })

  it('seed が違えば列が変わる', () => {
    const a = buildKanaDrill(SET, 40, { rng: mulberry32(1) })
    const b = buildKanaDrill(SET, 40, { rng: mulberry32(2) })
    expect(a).not.toEqual(b)
  })

  it('count=0 なら空配列', () => {
    expect(buildKanaDrill(SET, 0)).toEqual([])
  })

  it('多字かな（きゃ）も1要素として扱える（分割されない）', () => {
    // 2要素集合＋連続回避＝交互になるので、多字かなも1単位で必ず出現する。
    const set = ['か', 'きゃ']
    const out = buildKanaDrill(set, 10, { rng: mulberry32(7) })
    for (const k of out) expect(set).toContain(k)
    expect(out).toContain('きゃ')
  })
})
