import { describe, it, expect } from 'vitest'
// Issue #402 穴埋め学習モード（TDD Red）。
// 本体 src/domain/session/learningSequence.service.js は coder が Green で作る（現状未実装＝import で undefined）。
import { tagLearningBlocks, itemsTargetFor, hudEndFor } from './learningSequence.service.js'

// テスト用の最小 item（実体は問わない＝タグ付けは参照を保持するだけ）
const A = { en: 'a' }
const B = { en: 'b' }
const C = { en: 'c' }
const D = { en: 'd' }
const E = { en: 'e' }
const F = { en: 'f' }

describe('tagLearningBlocks（normal ブロック→同じ順で cloze ブロックを繰り返す）', () => {
  it('blockSize=2, items=[A,B,C] は [A-n,B-n,A-c,B-c,C-n,C-c] を返す（末尾端数は単独ブロック）', () => {
    const out = tagLearningBlocks([A, B, C], { blockSize: 2 })
    expect(out).toEqual([
      { item: A, phase: 'normal' },
      { item: B, phase: 'normal' },
      { item: A, phase: 'cloze' },
      { item: B, phase: 'cloze' },
      { item: C, phase: 'normal' },
      { item: C, phase: 'cloze' },
    ])
  })

  it('items が空なら空を返す', () => {
    expect(tagLearningBlocks([], { blockSize: 5 })).toEqual([])
  })

  it('items.length < blockSize のときは単一ブロック（normal 全部→cloze 全部）', () => {
    const out = tagLearningBlocks([A, B, C], { blockSize: 5 })
    expect(out).toEqual([
      { item: A, phase: 'normal' },
      { item: B, phase: 'normal' },
      { item: C, phase: 'normal' },
      { item: A, phase: 'cloze' },
      { item: B, phase: 'cloze' },
      { item: C, phase: 'cloze' },
    ])
  })

  it('blockSize 既定は 5（省略時）', () => {
    const items = [A, B, C, D, E, F]
    const out = tagLearningBlocks(items)
    // 先頭5個 normal → 同じ5個 cloze → 端数 F の normal → F の cloze
    expect(out.slice(0, 5)).toEqual([
      { item: A, phase: 'normal' },
      { item: B, phase: 'normal' },
      { item: C, phase: 'normal' },
      { item: D, phase: 'normal' },
      { item: E, phase: 'normal' },
    ])
    expect(out.slice(5, 10)).toEqual([
      { item: A, phase: 'cloze' },
      { item: B, phase: 'cloze' },
      { item: C, phase: 'cloze' },
      { item: D, phase: 'cloze' },
      { item: E, phase: 'cloze' },
    ])
    expect(out.slice(10)).toEqual([
      { item: F, phase: 'normal' },
      { item: F, phase: 'cloze' },
    ])
  })

  it('blockSize<=0 は 1 に丸める（throw しない・各 item が単独ブロック）', () => {
    const out = tagLearningBlocks([A, B], { blockSize: 0 })
    expect(out).toEqual([
      { item: A, phase: 'normal' },
      { item: A, phase: 'cloze' },
      { item: B, phase: 'normal' },
      { item: B, phase: 'cloze' },
    ])
    // 負値も同様に 1 丸め
    expect(tagLearningBlocks([A], { blockSize: -3 })).toEqual([
      { item: A, phase: 'normal' },
      { item: A, phase: 'cloze' },
    ])
  })

  it('出力長は常に 2×items.length（各 item が normal と cloze で1回ずつ）', () => {
    for (const n of [1, 2, 3, 4, 7, 11]) {
      const items = Array.from({ length: n }, (_, i) => ({ en: `w${i}` }))
      const out = tagLearningBlocks(items, { blockSize: 5 })
      expect(out).toHaveLength(2 * n)
      const normals = out.filter((x) => x.phase === 'normal')
      const clozes = out.filter((x) => x.phase === 'cloze')
      expect(normals).toHaveLength(n)
      expect(clozes).toHaveLength(n)
      // 各 item がちょうど normal 1回・cloze 1回
      for (const it of items) {
        expect(out.filter((x) => x.item === it && x.phase === 'normal')).toHaveLength(1)
        expect(out.filter((x) => x.item === it && x.phase === 'cloze')).toHaveLength(1)
      }
    }
  })

  it('純粋：入力配列を破壊せず、同入力なら同出力（冪等）', () => {
    const items = [A, B, C, D, E, F]
    const snapshot = [...items]
    const a = tagLearningBlocks(items, { blockSize: 2 })
    const b = tagLearningBlocks(items, { blockSize: 2 })
    expect(items).toEqual(snapshot) // 非破壊
    expect(a).toEqual(b) // 冪等
  })
})

describe('itemsTargetFor（cloze は items 目標を 2 倍にする）', () => {
  it("kind=items かつ learningMode='cloze' なら value*2", () => {
    expect(itemsTargetFor({ kind: 'items', value: 10 }, 'cloze')).toBe(20)
  })

  it("kind=items かつ cloze 以外なら value のまま", () => {
    expect(itemsTargetFor({ kind: 'items', value: 10 }, 'normal')).toBe(10)
  })

  it('learningMode 未指定は normal 扱い（2倍しない）', () => {
    expect(itemsTargetFor({ kind: 'items', value: 25 })).toBe(25)
  })

  it('kind が items 以外（time/chars/life/endless）は null を返す（2倍しない）', () => {
    expect(itemsTargetFor({ kind: 'time', value: 60 }, 'cloze')).toBeNull()
    expect(itemsTargetFor({ kind: 'chars', value: 600 }, 'cloze')).toBeNull()
    expect(itemsTargetFor({ kind: 'life', value: 3 }, 'cloze')).toBeNull()
    expect(itemsTargetFor({ kind: 'endless', value: null }, 'cloze')).toBeNull()
  })

  it('value=0 の端ケースでも例外を投げず数値を返す（cloze→0 / normal→0）', () => {
    expect(itemsTargetFor({ kind: 'items', value: 0 }, 'cloze')).toBe(0)
    expect(itemsTargetFor({ kind: 'items', value: 0 }, 'normal')).toBe(0)
  })
})

// #406 HUD の分母（実効目標）補正。cloze×items は finish 側（itemsTargetFor）と一致させて 2 倍する。
// items 以外・normal はそのまま返す（据置）。純粋・入力非破壊。
describe('hudEndFor（cloze×items のとき HUD 目標を2倍にする）', () => {
  it("kind=items かつ learningMode='cloze' なら value を 2 倍した EndCondition を返す", () => {
    expect(hudEndFor({ kind: 'items', value: 25 }, 'cloze')).toEqual({ kind: 'items', value: 50 })
    expect(hudEndFor({ kind: 'items', value: 10 }, 'cloze')).toEqual({ kind: 'items', value: 20 })
  })

  it('kind=items だが normal（cloze 以外）は据置（同じ endCondition を返す）', () => {
    const ec = { kind: 'items', value: 25 }
    expect(hudEndFor(ec, 'normal')).toBe(ec)
    expect(hudEndFor(ec)).toBe(ec) // 未指定＝normal 扱い
  })

  it('items 以外（time/chars/life/endless）は cloze でも据置（同じ endCondition を返す）', () => {
    for (const ec of [
      { kind: 'time', value: 60 },
      { kind: 'chars', value: 600 },
      { kind: 'life', value: 3 },
      { kind: 'endless', value: null },
    ]) {
      expect(hudEndFor(ec, 'cloze')).toBe(ec)
    }
  })

  it('endCondition が null/undefined でも例外を投げず据置で返す', () => {
    expect(hudEndFor(null, 'cloze')).toBeNull()
    expect(hudEndFor(undefined, 'cloze')).toBeUndefined()
  })

  it('純粋：入力 endCondition を破壊しない（cloze×items でも元は不変）', () => {
    const ec = { kind: 'items', value: 25 }
    const snapshot = { ...ec }
    hudEndFor(ec, 'cloze')
    expect(ec).toEqual(snapshot)
  })
})
