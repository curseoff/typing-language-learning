import { describe, it, expect, vi } from 'vitest'
// #290 Phase 8: Application Service（ユースケースの薄い調停）。
//   recordFinishedSession は「1回のプレイ完了」を、これまでの全部品へ調停するだけの薄い層。
//   - 業務ルール（判定・計算・整列・上限）は一切持たず、ドメインオブジェクト／Port（Repository）／
//     Event へ委譲するだけ（Domain Service sessionToRecord・recKey・Repository.submitRecord・EventBus）。
//   - 手順（副作用の順序）：record 生成 → key 算出 → Repository へ submit → イベント2発 → 返す。
//   - 純アプリ層：React/DOM/Date/乱数 非依存。時刻等の外部値は meta として注入で受け取る。
// 本体 src/application/records/recordFinishedSession.js は coder が Green で作る（現状未実装＝import で undefined）。
import { recordFinishedSession } from './recordFinishedSession.service.js'

// 調停対象の既存部品（App Service が「独自計算せず委譲している」ことを裏取りするために直接も使う）。
import { startTypingSession } from '../../domain/session/typingSession.entity.js'
import { makeEndCondition } from '../../domain/session/endCondition.vo.js'
import { sessionToRecord } from '../../domain/records/sessionResult.service.js'
import { recKey } from '../../domain/records/ranking.service.js'
import {
  createRankingRepository,
  createInMemoryRankingStore,
} from '../../domain/records/ranking.repository.js'
import { createEventBus } from '../../application/events/eventBus.service.js'

// 代表的な完走セッションを組み立てるヘルパ（keys/mistakes/elapsed を注入）。
function playedSession({ id = 's1', keys = 20, mistakes = 5, elapsedMs = 60000 } = {}) {
  const s = startTypingSession({ id, endCondition: makeEndCondition('time', 60) })
  for (let i = 0; i < keys; i++) s.registerHit()
  for (let i = 0; i < mistakes; i++) s.registerMiss()
  s.setElapsed(elapsedMs)
  return s
}

// 標準の meta（recKey / sessionToRecord に渡す文脈）。
const META = { mode: 'en', rank: 2, source: 'romaji', theme: '旅行', date: '2026-07-09' }

// Repository（in-memory）＋ EventBus の新品を毎回そろえる。
function setup() {
  const repository = createRankingRepository(createInMemoryRankingStore())
  const bus = createEventBus()
  return { repository, bus }
}

describe('recordFinishedSession（Application Service：1プレイ完了の薄い調停）', () => {
  describe('調停の結果（返り値 record/key/board）', () => {
    it('record が sessionToRecord(session, meta) 相当（keys/mistakes/speed/accuracy/seconds＋meta）になる', () => {
      const session = playedSession({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      const { repository, bus } = setup()

      const { record } = recordFinishedSession({ session, meta: META, repository, bus })

      // score の性質（sessionResult.test.js と同じ代表値）：keys20/mistakes5/elapsed60000。
      expect(record.keys).toBe(20)
      expect(record.mistakes).toBe(5)
      expect(record.speed).toBe(20)
      expect(record.accuracy).toBe(80)
      expect(record.seconds).toBe(60)
      // meta もそのまま乗る。
      expect(record.mode).toBe('en')
      expect(record.rank).toBe(2)
      expect(record.source).toBe('romaji')
      expect(record.theme).toBe('旅行')
      expect(record.date).toBe('2026-07-09')
    })

    it('key が recKey(mode, rank, source, theme, session.endCondition) と一致する', () => {
      const session = playedSession()
      const { repository, bus } = setup()

      const { key } = recordFinishedSession({ session, meta: META, repository, bus })

      expect(key).toBe(
        recKey(META.mode, META.rank, META.source, META.theme, session.endCondition),
      )
    })

    it('board が submit 済み集約＝repository.findByKey(key, ec) の entries と等価になる', () => {
      const session = playedSession()
      const ec = session.endCondition
      const { repository, bus } = setup()

      const { key, board } = recordFinishedSession({ session, meta: META, repository, bus })

      const stored = repository.findByKey(key, ec)
      expect(board.entries()).toEqual(stored.entries())
    })

    it('返り値 board の先頭に投入した record が入っている', () => {
      const session = playedSession({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      const { repository, bus } = setup()

      const { record, board } = recordFinishedSession({ session, meta: META, repository, bus })

      expect(board.entries()[0]).toEqual(record)
    })
  })

  describe('Repository への反映（Port 経由の read-modify-write）', () => {
    it('呼び出し後 repository.findByKey(key, ec) にその記録が入っている', () => {
      const session = playedSession({ keys: 12, mistakes: 3, elapsedMs: 30000 })
      const ec = session.endCondition
      const { repository, bus } = setup()

      const { key, record } = recordFinishedSession({ session, meta: META, repository, bus })

      const board = repository.findByKey(key, ec)
      expect(board.entries()).toContainEqual(record)
    })

    it('同じ key へ複数回呼ぶと集約が積み上がる（件数が増える）', () => {
      const ec = makeEndCondition('time', 60)
      const { repository, bus } = setup()

      let key
      for (let i = 0; i < 3; i++) {
        const session = playedSession({ id: `s${i}`, keys: 10 + i, mistakes: 0, elapsedMs: 60000 })
        ;({ key } = recordFinishedSession({ session, meta: META, repository, bus }))
      }

      expect(repository.findByKey(key, ec).size()).toBe(3)
    })

    it('16回以上呼んでも集約の不変条件（top15・keys 降順で整列）を保つ', () => {
      const ec = makeEndCondition('time', 60)
      const { repository, bus } = setup()

      let key
      // keys を 1..20 でばらつかせて 20 回投入（time60 は keys 降順ランキング）。
      for (let i = 1; i <= 20; i++) {
        const session = playedSession({ id: `s${i}`, keys: i, mistakes: 0, elapsedMs: 60000 })
        ;({ key } = recordFinishedSession({ session, meta: META, repository, bus }))
      }

      const board = repository.findByKey(key, ec)
      const entries = board.entries()
      // 上限 15 件に絞られる。
      expect(entries.length).toBe(15)
      // keys 降順で整列（最上位＝最大 keys=20、末尾＝15番目に大きい keys=6）。
      const keysList = entries.map((r) => r.keys)
      expect(keysList[0]).toBe(20)
      expect(keysList[keysList.length - 1]).toBe(6)
      const sortedDesc = [...keysList].sort((a, b) => b - a)
      expect(keysList).toEqual(sortedDesc)
    })
  })

  describe('イベント発行（疎結合・順序・payload）', () => {
    it('SessionFinished を {type, sessionId, record} で発行する', () => {
      const session = playedSession({ id: 's1' })
      const { repository, bus } = setup()
      const h1 = vi.fn()
      bus.subscribe('SessionFinished', h1)

      const { record } = recordFinishedSession({ session, meta: META, repository, bus })

      expect(h1).toHaveBeenCalledTimes(1)
      expect(h1).toHaveBeenCalledWith({ type: 'SessionFinished', sessionId: 's1', record })
    })

    it('RecordAchieved を {type, key, record} で発行する', () => {
      const session = playedSession({ id: 's1' })
      const { repository, bus } = setup()
      const h2 = vi.fn()
      bus.subscribe('RecordAchieved', h2)

      const { key, record } = recordFinishedSession({ session, meta: META, repository, bus })

      expect(h2).toHaveBeenCalledTimes(1)
      expect(h2).toHaveBeenCalledWith({ type: 'RecordAchieved', key, record })
    })

    it('発行順は SessionFinished → RecordAchieved（記録の後にイベント）', () => {
      const session = playedSession({ id: 's1' })
      const { repository, bus } = setup()
      const order = []
      bus.subscribe('SessionFinished', () => order.push('SessionFinished'))
      bus.subscribe('RecordAchieved', () => order.push('RecordAchieved'))

      recordFinishedSession({ session, meta: META, repository, bus })

      expect(order).toEqual(['SessionFinished', 'RecordAchieved'])
    })
  })

  describe('業務ルールを持たない（委譲だけ＝独自計算しない）', () => {
    it('返す record は sessionToRecord(session, meta) と完全一致する（App Service は独自に計算しない）', () => {
      const session = playedSession({ keys: 17, mistakes: 4, elapsedMs: 45000 })
      const { repository, bus } = setup()

      const { record } = recordFinishedSession({ session, meta: META, repository, bus })

      // App Service 呼び出しは session を破壊しないので、同じ session から期待値を再計算できる。
      expect(record).toEqual(sessionToRecord(session, META))
    })

    it('session を破壊しない（progress・status を変えない＝読み取り委譲のみ）', () => {
      const session = playedSession({ keys: 7, mistakes: 2, elapsedMs: 15000 })
      const before = session.progress()
      const { repository, bus } = setup()

      recordFinishedSession({ session, meta: META, repository, bus })

      expect(session.progress()).toEqual(before)
      expect(session.status()).toBe('active')
    })
  })
})
