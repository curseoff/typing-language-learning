import { describe, it, expect } from 'vitest'
// #290 Phase 5: Domain Service（どの Entity/VO にも自然に属さないロジック）。
// sessionToRecord は「Session Entity の状態(progress)」＋「採点ロジック(score)」＋「外部メタ(meta)」を
// またいで1つの記録オブジェクトへまとめる純関数。
//   - Session Entity 自身の責務でも、score VO 的計算の責務でもない＝どちらにも属さない横断操作＝Service。
//   - session を破壊しない（読み取りのみ）＝Service は状態を持たず副作用も持たない。
//
// 本体 src/domain/records/sessionResult.js は coder が Green で作る（現状未実装＝import で undefined）。
import { sessionToRecord } from './sessionResult.js'
// またぐ対象：Session Entity（progress を提供）と採点ロジック。
import { startTypingSession } from '../session/typingSession.js'
import { makeEndCondition } from '../session/endCondition.js'

// 代表的な完走セッションを組み立てるヘルパ（keys/mistakes/elapsed を注入）。
function playedSession({ id = 's1', keys = 0, mistakes = 0, elapsedMs = 0 } = {}) {
  const s = startTypingSession({ id, endCondition: makeEndCondition('time', 60) })
  for (let i = 0; i < keys; i++) s.registerHit()
  for (let i = 0; i < mistakes; i++) s.registerMiss()
  s.setElapsed(elapsedMs)
  return s
}

describe('sessionToRecord（Domain Service：Entity 状態＋採点＋meta を横断してまとめる）', () => {
  describe('採点の合成（progress → score）', () => {
    it('keys20/mistakes5/elapsed60000 のセッションを keys20・mistakes5・speed20・accuracy80・seconds60 に採点する', () => {
      const s = playedSession({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      const rec = sessionToRecord(s, { mode: 'en', rank: 2, source: 'romaji', date: '2026-07-09' })
      expect(rec.keys).toBe(20)
      expect(rec.mistakes).toBe(5)
      expect(rec.speed).toBe(20)
      expect(rec.accuracy).toBe(80)
      expect(rec.seconds).toBe(60)
    })

    it('progress の keys/mistakes をそのまま記録に含める（採点値だけでなく素の進捗も残す）', () => {
      const s = playedSession({ keys: 12, mistakes: 3, elapsedMs: 30000 })
      const rec = sessionToRecord(s)
      expect(rec.keys).toBe(12)
      expect(rec.mistakes).toBe(3)
    })
  })

  describe('meta のマージ（外部から与える文脈をそのまま乗せる）', () => {
    it('meta の各キー（mode/rank/source/theme/date）が記録に含まれる', () => {
      const s = playedSession({ keys: 10, mistakes: 0, elapsedMs: 60000 })
      const meta = { mode: 'ja', rank: 3, source: 'kana', theme: '旅行', date: '2026-07-09' }
      const rec = sessionToRecord(s, meta)
      expect(rec.mode).toBe('ja')
      expect(rec.rank).toBe(3)
      expect(rec.source).toBe('kana')
      expect(rec.theme).toBe('旅行')
      expect(rec.date).toBe('2026-07-09')
    })

    it('meta 省略時でも採点フィールドは揃う（keys/mistakes/speed/accuracy/seconds）', () => {
      const s = playedSession({ keys: 10, mistakes: 0, elapsedMs: 60000 })
      const rec = sessionToRecord(s)
      for (const key of ['keys', 'mistakes', 'speed', 'accuracy', 'seconds']) {
        expect(rec).toHaveProperty(key)
      }
    })
  })

  describe('端ケース（score の性質を反映）', () => {
    it('keys=0・elapsedMs=0 のセッションは speed=0・accuracy=100（ゼロ除算回避の既定）', () => {
      const s = playedSession({ keys: 0, mistakes: 0, elapsedMs: 0 })
      const rec = sessionToRecord(s)
      expect(rec.speed).toBe(0)
      expect(rec.accuracy).toBe(100)
      expect(rec.seconds).toBe(0)
    })
  })

  describe('session を破壊しない（Service は読み取りのみ）', () => {
    it('sessionToRecord 呼び出し後も session.progress() が変わらない', () => {
      const s = playedSession({ keys: 7, mistakes: 2, elapsedMs: 15000 })
      const before = s.progress()
      sessionToRecord(s, { mode: 'en' })
      expect(s.progress()).toEqual(before)
    })

    it('session の status は変わらない（active のまま＝finish を呼ばない）', () => {
      const s = playedSession({ keys: 7, mistakes: 2, elapsedMs: 15000 })
      sessionToRecord(s)
      expect(s.status()).toBe('active')
    })
  })
})
