import { describe, it, expect } from 'vitest'
// #290 Phase 3（Aggregate + Aggregate Root + Invariant）の Red。
// RankingBoard は記録ランキングを表す集約。集約ルートが不変条件（top MAX_RECORDS・
// compareRecords 順の整列）を常に保証し、状態変更はルートの submit() 経由のみとする。
// 本体（src/domain/records/rankingBoard.js）は未実装＝import で Red になる想定。
import { makeRankingBoard, rankingBoardEquals } from './rankingBoard.js'
import { MAX_RECORDS, compareRecords } from './ranking.js'
import { makeEndCondition, isEndCondition } from '../session/endCondition.js'

const TIME60 = makeEndCondition('time', 60)
const CHARS = makeEndCondition('chars', 600)

// time60 の記録（keys 降順→mistakes 昇順で並ぶ）。
const rec = (keys, mistakes = 0) => ({ keys, mistakes, date: '2026-01-01' })
// chars600 の記録（seconds 昇順で並ぶ）。
const charRec = (seconds, mistakes = 0) => ({ seconds, mistakes, date: '2026-01-01' })

// 集約の不変条件：entries が compareRecords(ec) で整列済みか（隣接ペアで cmp<=0）。
const isSorted = (entries, ec) =>
  entries.every((r, i) => i === 0 || compareRecords(ec, entries[i - 1], r) <= 0)

describe('makeRankingBoard（集約ルートの生成と自己検証）', () => {
  it('key と endCondition（VO）と空 entries でルートを生成する', () => {
    const board = makeRankingBoard({ key: 'both__r1', endCondition: TIME60 })
    expect(board.key).toBe('both__r1')
    expect(board.size()).toBe(0)
    expect(board.entries()).toEqual([])
  })

  it('endCondition を VO として内包する（isEndCondition を満たす）', () => {
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60 })
    expect(isEndCondition(board.endCondition)).toBe(true)
    expect(board.endCondition.kind).toBe('time')
    expect(board.endCondition.value).toBe(60)
  })

  it('key が空文字は throw する（同一性を持てないため）', () => {
    expect(() => makeRankingBoard({ key: '', endCondition: TIME60 })).toThrow()
  })

  it('key が null は throw する', () => {
    expect(() => makeRankingBoard({ key: null, endCondition: TIME60 })).toThrow()
  })

  it('key が非文字列（数値）は throw する', () => {
    expect(() => makeRankingBoard({ key: 123, endCondition: TIME60 })).toThrow()
  })

  it('endCondition が不正な VO は throw する（VO 内包の強制）', () => {
    expect(() => makeRankingBoard({ key: 'k', endCondition: { kind: 'mystery' } })).toThrow()
    expect(() => makeRankingBoard({ key: 'k', endCondition: null })).toThrow()
  })
})

describe('makeRankingBoard（生成時に不変条件へ正規化）', () => {
  it('順不同の初期 entries を整列して取り込む（time60＝keys 降順）', () => {
    const board = makeRankingBoard({
      key: 'k',
      endCondition: TIME60,
      entries: [rec(300), rec(500), rec(400)],
    })
    expect(board.entries().map((r) => r.keys)).toEqual([500, 400, 300])
    expect(isSorted(board.entries(), TIME60)).toBe(true)
  })

  it('MAX_RECORDS を超える初期 entries は上位 MAX_RECORDS 件へ切り詰める', () => {
    const entries = []
    for (let i = 0; i < MAX_RECORDS + 10; i++) entries.push(rec(i))
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries })
    expect(board.size()).toBe(MAX_RECORDS)
    // 上位＝keys 最大が残り、最小側が切り捨てられる。
    expect(board.entries()[0].keys).toBe(MAX_RECORDS + 9)
    expect(board.entries().every((r) => r.keys >= 10)).toBe(true)
  })

  it('endCondition により整列規則が変わる（chars600＝seconds 昇順）', () => {
    const board = makeRankingBoard({
      key: 'k',
      endCondition: CHARS,
      entries: [charRec(20), charRec(8), charRec(12)],
    })
    expect(board.entries().map((r) => r.seconds)).toEqual([8, 12, 20])
    expect(isSorted(board.entries(), CHARS)).toBe(true)
  })
})

describe('board.submit（状態変更はルート経由のみ・整列と上限を維持）', () => {
  it('空/15未満のとき追加され整列される', () => {
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(300), rec(500)] })
    const next = board.submit(rec(400))
    expect(next.entries().map((r) => r.keys)).toEqual([500, 400, 300])
    expect(isSorted(next.entries(), TIME60)).toBe(true)
  })

  it('満杯(15)で既存最下位より良い記録は挿入され、最下位が押し出される', () => {
    const entries = []
    for (let i = 1; i <= MAX_RECORDS; i++) entries.push(rec(i)) // keys 1..15（最下位=1）
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries })
    const next = board.submit(rec(100))
    expect(next.size()).toBe(MAX_RECORDS)
    const keys = next.entries().map((r) => r.keys)
    expect(keys).toContain(100) // 新記録は入る
    expect(keys).not.toContain(1) // 旧最下位は押し出される
  })

  it('満杯で全既存より悪い記録は入らない（entries 不変）', () => {
    const entries = []
    for (let i = 1; i <= MAX_RECORDS; i++) entries.push(rec(i)) // keys 1..15
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries })
    const before = board.entries().map((r) => r.keys)
    const next = board.submit(rec(0)) // 最下位(1)より悪い
    expect(next.size()).toBe(MAX_RECORDS)
    expect(next.entries().map((r) => r.keys)).toEqual(before)
    expect(next.entries().map((r) => r.keys)).not.toContain(0)
  })
})

describe('board.entries（凍結スナップショット・カプセル化）', () => {
  it('entries() は凍結された配列を返す（Object.isFrozen true）', () => {
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(500)] })
    expect(Object.isFrozen(board.entries())).toBe(true)
  })

  it('返した entries を書き換えても board 内部は不変（ルート経由でしか変えられない）', () => {
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(500), rec(300)] })
    const snapshot = board.entries()
    try {
      snapshot.push(rec(999))
      snapshot[0] = rec(1)
    } catch {
      // 凍結配列への破壊的操作は throw しうる＝それでも内部は不変であることを以下で確認。
    }
    expect(board.size()).toBe(2)
    expect(board.entries().map((r) => r.keys)).toEqual([500, 300])
  })
})

describe('board のクエリ（size / isFull / best）', () => {
  it('size は件数、isFull は size===MAX_RECORDS', () => {
    const entries = []
    for (let i = 1; i <= MAX_RECORDS; i++) entries.push(rec(i))
    const full = makeRankingBoard({ key: 'k', endCondition: TIME60, entries })
    expect(full.size()).toBe(MAX_RECORDS)
    expect(full.isFull()).toBe(true)

    const partial = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(1)] })
    expect(partial.isFull()).toBe(false)
  })

  it('best は先頭（最良）を返し、空なら null', () => {
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(300), rec(500)] })
    expect(board.best().keys).toBe(500)

    const empty = makeRankingBoard({ key: 'k', endCondition: TIME60 })
    expect(empty.best()).toBe(null)
  })
})

describe('不変条件（どの操作後も常に真）', () => {
  it('大量 submit しても size は MAX_RECORDS 以下で整列を保つ', () => {
    let board = makeRankingBoard({ key: 'k', endCondition: TIME60 })
    for (let i = 0; i < MAX_RECORDS + 5; i++) board = board.submit(rec((i * 37) % 100))
    expect(board.entries().length).toBeLessThanOrEqual(MAX_RECORDS)
    expect(board.size()).toBe(MAX_RECORDS)
    expect(isSorted(board.entries(), TIME60)).toBe(true)
  })

  it('endCondition 別（chars600）でも大量 submit で整列と上限を保つ', () => {
    let board = makeRankingBoard({ key: 'k', endCondition: CHARS })
    for (let i = 0; i < MAX_RECORDS + 5; i++) board = board.submit(charRec((i * 13) % 90))
    expect(board.entries().length).toBeLessThanOrEqual(MAX_RECORDS)
    expect(isSorted(board.entries(), CHARS)).toBe(true)
  })
})

describe('rankingBoardEquals（集約ルートの同一性＝Entity）', () => {
  it('key が一致すれば entries が違っても true（同一性・値等価ではない）', () => {
    const a = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(500)] })
    const b = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(100), rec(200)] })
    expect(rankingBoardEquals(a, b)).toBe(true)
  })

  it('key が違えば entries が同じでも false', () => {
    const a = makeRankingBoard({ key: 'k1', endCondition: TIME60, entries: [rec(500)] })
    const b = makeRankingBoard({ key: 'k2', endCondition: TIME60, entries: [rec(500)] })
    expect(rankingBoardEquals(a, b)).toBe(false)
  })

  it('null や不正な引数は throw せず false を返す', () => {
    const a = makeRankingBoard({ key: 'k', endCondition: TIME60 })
    expect(rankingBoardEquals(a, null)).toBe(false)
    expect(rankingBoardEquals(null, a)).toBe(false)
    expect(rankingBoardEquals(null, null)).toBe(false)
    expect(rankingBoardEquals(a, {})).toBe(false)
  })
})
