import { describe, it, expect } from 'vitest'
// #290 Phase 4（Repository / Port-Adapter）の Red。
// RankingBoard 集約を「コレクションのように出し入れする永続化抽象＝Repository」で扱う。
// Repository は注入された store（Port）に依存し、実体（in-memory / sqlite）は差し替え可能。
// ドメインは永続化の詳細を知らない（永続化無知）。今回は in-memory アダプタで完結する。
// 本体（src/domain/records/ranking.repository.js）は未実装＝import で Red になる想定。
import {
  createInMemoryRankingStore,
  createRankingRepository,
} from './ranking.repository.js'
import { makeRankingBoard, rankingBoardEquals } from './rankingBoard.aggregate.js'
import { MAX_RECORDS } from './ranking.service.js'
import { makeEndCondition } from '../session/endCondition.vo.js'

const TIME60 = makeEndCondition('time', 60)
const CHARS = makeEndCondition('chars', 600)

// time60 の記録（keys 降順→mistakes 昇順で並ぶ）。
const rec = (keys, mistakes = 0) => ({ keys, mistakes, date: '2026-01-01' })
// chars600 の記録（seconds 昇順で並ぶ）。
const charRec = (seconds, mistakes = 0) => ({ seconds, mistakes, date: '2026-01-01' })

describe('createInMemoryRankingStore（Port の学習/テスト用アダプタ）', () => {
  it('未保存キーの load は undefined を返す', () => {
    const store = createInMemoryRankingStore()
    expect(store.load('none')).toBeUndefined()
  })

  it('save した記録配列を同じキーで load できる（round-trip）', () => {
    const store = createInMemoryRankingStore()
    const records = [rec(500), rec(300)]
    store.save('k', records)
    expect(store.load('k')).toEqual([rec(500), rec(300)])
  })

  it('キーごとに独立して保存する（別キーは干渉しない）', () => {
    const store = createInMemoryRankingStore()
    store.save('a', [rec(100)])
    store.save('b', [rec(200)])
    expect(store.load('a')).toEqual([rec(100)])
    expect(store.load('b')).toEqual([rec(200)])
  })

  it('保存はスナップショット＝渡した配列を後から破壊しても store 内は不変', () => {
    const store = createInMemoryRankingStore()
    const records = [rec(500), rec(300)]
    store.save('k', records)
    // 呼び出し側が渡した配列を後から破壊的に変更する。
    records.push(rec(999))
    records[0] = rec(1)
    expect(store.load('k')).toEqual([rec(500), rec(300)])
  })
})

describe('createRankingRepository.findByKey（集約の再構築）', () => {
  it('store に該当キーがあれば記録から RankingBoard を再構築して返す（round-trip 等価）', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    // 集約を作って複数 submit → save → findByKey で等価な集約が戻る。
    let board = makeRankingBoard({ key: 'both__r1', endCondition: TIME60 })
    board = board.submit(rec(300))
    board = board.submit(rec(500))
    board = board.submit(rec(400))
    repo.save(board)

    const loaded = repo.findByKey('both__r1', TIME60)
    // key 一致（集約の同一性）。
    expect(rankingBoardEquals(loaded, board)).toBe(true)
    // entries の内容一致（整列済みで再構築されている）。
    expect(loaded.entries()).toEqual(board.entries())
    expect(loaded.entries().map((r) => r.keys)).toEqual([500, 400, 300])
  })

  it('未保存キーの findByKey は null を返す', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    expect(repo.findByKey('none', TIME60)).toBe(null)
  })

  it('endCondition 別（chars600）でも整列規則を保って再構築する（seconds 昇順）', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    let board = makeRankingBoard({ key: 'k', endCondition: CHARS })
    board = board.submit(charRec(20))
    board = board.submit(charRec(8))
    board = board.submit(charRec(12))
    repo.save(board)

    const loaded = repo.findByKey('k', CHARS)
    expect(loaded.entries().map((r) => r.seconds)).toEqual([8, 12, 20])
    expect(rankingBoardEquals(loaded, board)).toBe(true)
  })
})

describe('createRankingRepository.save（集約を store へ永続化）', () => {
  it('board.entries() を board.key で store に保存する', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    const board = makeRankingBoard({
      key: 'k',
      endCondition: TIME60,
      entries: [rec(300), rec(500)],
    })
    repo.save(board)
    // 整列済み entries が保存される。
    expect(store.load('k')).toEqual([rec(500), rec(300)])
  })

  it('save 後に元 board へ更に submit しても store の内容は save 時点で独立（スナップショット）', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    const board = makeRankingBoard({ key: 'k', endCondition: TIME60, entries: [rec(500)] })
    repo.save(board)
    // submit は新 board を返すのみ（元は不変）。store も影響を受けない。
    board.submit(rec(999))
    expect(store.load('k')).toEqual([rec(500)])
  })
})

describe('createRankingRepository（永続化無知／Port 差し替え可能）', () => {
  it('store をモック実装に差し替えても findByKey/save が同契約で動く', () => {
    // in-memory とは別の store 実装（Port の別アダプタ）。プレーンオブジェクト backing。
    const backing = {}
    const mockStore = {
      load: (key) => (key in backing ? backing[key] : undefined),
      save: (key, records) => {
        backing[key] = records.map((r) => ({ ...r }))
      },
    }
    const repo = createRankingRepository(mockStore)

    let board = makeRankingBoard({ key: 'k', endCondition: TIME60 })
    board = board.submit(rec(400))
    board = board.submit(rec(600))
    repo.save(board)

    // Repository の実装は変えずに、別バックエンドで同じ契約が成立する。
    const loaded = repo.findByKey('k', TIME60)
    expect(rankingBoardEquals(loaded, board)).toBe(true)
    expect(loaded.entries().map((r) => r.keys)).toEqual([600, 400])
    expect(repo.findByKey('none', TIME60)).toBe(null)
  })
})

describe('createRankingRepository.submitRecord（read-modify-write を1メソッドに）', () => {
  it('空状態から submitRecord すると load→submit→save が行われ最新集約を返す', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    const board = repo.submitRecord('k', TIME60, rec(500))
    expect(board.key).toBe('k')
    expect(board.entries().map((r) => r.keys)).toEqual([500])
    // store にも反映されている。
    expect(store.load('k')).toEqual([rec(500)])
  })

  it('複数回 submitRecord すると毎回 store に反映され整列済み集約を返す', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    repo.submitRecord('k', TIME60, rec(300))
    repo.submitRecord('k', TIME60, rec(500))
    const board = repo.submitRecord('k', TIME60, rec(400))
    expect(board.entries().map((r) => r.keys)).toEqual([500, 400, 300])
    // findByKey でも最新の整列済み集約が得られる。
    const loaded = repo.findByKey('k', TIME60)
    expect(loaded.entries().map((r) => r.keys)).toEqual([500, 400, 300])
  })

  it('満杯超過でも 15 件維持（集約の不変条件が Repository 経由でも保たれる）', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    let board
    for (let i = 0; i < MAX_RECORDS + 5; i++) {
      board = repo.submitRecord('k', TIME60, rec((i * 37) % 100))
    }
    expect(board.size()).toBe(MAX_RECORDS)
    // store 経由でも 15 件・整列を保つ。
    const loaded = repo.findByKey('k', TIME60)
    expect(loaded.size()).toBe(MAX_RECORDS)
    const keys = loaded.entries().map((r) => r.keys)
    const sortedDesc = [...keys].sort((a, b) => b - a)
    expect(keys).toEqual(sortedDesc)
  })

  it('endCondition 別（chars600）の submitRecord でも整列規則（seconds 昇順）を保つ', () => {
    const store = createInMemoryRankingStore()
    const repo = createRankingRepository(store)
    repo.submitRecord('k', CHARS, charRec(20))
    repo.submitRecord('k', CHARS, charRec(8))
    const board = repo.submitRecord('k', CHARS, charRec(12))
    expect(board.entries().map((r) => r.seconds)).toEqual([8, 12, 20])
    const loaded = repo.findByKey('k', CHARS)
    expect(loaded.entries().map((r) => r.seconds)).toEqual([8, 12, 20])
  })
})
