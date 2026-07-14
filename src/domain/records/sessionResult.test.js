import { describe, it, expect } from 'vitest'
// #290 Phase 5: Domain Service（どの Entity/VO にも自然に属さないロジック）。
// sessionToRecord は「Session Entity の状態(progress)」＋「採点ロジック(score)」＋「外部メタ(meta)」を
// またいで1つの記録オブジェクトへまとめる純関数。
//   - Session Entity 自身の責務でも、score VO 的計算の責務でもない＝どちらにも属さない横断操作＝Service。
//   - session を破壊しない（読み取りのみ）＝Service は状態を持たず副作用も持たない。
//
// 本体 src/domain/records/sessionResult.service.js は coder が Green で作る（現状未実装＝import で undefined）。
import { sessionToRecord, quizToRecord } from './sessionResult.service.js'
// またぐ対象：Session Entity（progress を提供）と採点ロジック。
import { startTypingSession } from '../session/typingSession.entity.js'
import { makeEndCondition } from '../session/endCondition.vo.js'

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

// #389 方針A：クイズ（useWordQuiz/useDictQuiz）の記録生成を domain の純ビルダーへ集約する。
// quizToRecord は「素の進捗（keys/mistakes/correct/total/elapsedMs）」＋「採点（quizScore）」＋「外部メタ」を
// またいで1つの記録オブジェクトを作る純関数。現行クイズ record（useWordQuiz.js:96-118 / useDictQuiz.js:109-128）の
// スコア/カウント部（keys, speed, correct, words(=total), mistakes, accuracy, seconds）と値・フィールドを一致させる。
//   - correctCount（segStats 由来の一発正解数）はビルダー引数でなく meta で受ける。
//   - 現行クイズ record は plain オブジェクトで下流（saveWordRecord/setRecords）が触る＝凍結しない（plain を返す）。
// 想定シグネチャ：quizToRecord({ keys, mistakes, correct, total, elapsedMs }, meta = {})
//   → { ...meta, keys, mistakes, correct, words: total, speed, accuracy, seconds }
// 本体 src/domain/records/sessionResult.service.js は coder が Green で作る（現状 quizToRecord 未実装＝undefined）。
describe('quizToRecord（Domain Service：進捗＋quizScore＋meta を横断してクイズ記録を作る）', () => {
  // quizScore と一致することを pin するための実式（segmentStats.service.js:31-37 と同じ）。
  const expectAccuracy = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : 0)
  const expectSpeed = (keys, elapsedMs) => (elapsedMs > 0 ? Math.round(keys / (elapsedMs / 60000)) : 0)
  const expectSeconds = (elapsedMs) => Math.round(elapsedMs / 100) / 10

  describe('通常値（現行クイズ record のスコア/カウント部と一致）', () => {
    const args = { keys: 120, mistakes: 3, correct: 20, total: 25, elapsedMs: 60000 }
    const meta = {
      source: 'word',
      mode: 'quiz-en',
      level: 1,
      theme: 'すべて',
      seed: 'x',
      endCondition: { kind: 'items', value: 25 },
      correctCount: 18,
      date: '2026/01/01',
      segStats: [],
    }

    it('スコア/カウント項目（keys/mistakes/correct/words/speed/accuracy/seconds）が現行 record と一致する', () => {
      const rec = quizToRecord(args, meta)
      expect(rec.keys).toBe(120)
      expect(rec.mistakes).toBe(3)
      expect(rec.correct).toBe(20)
      expect(rec.words).toBe(25) // words = total
      // 実式で pin：accuracy=Math.round(20/25*100)=80, speed=Math.round(120/(60000/60000))=120, seconds=Math.round(60000/100)/10=60
      expect(rec.accuracy).toBe(80)
      expect(rec.speed).toBe(120)
      expect(rec.seconds).toBe(60)
      expect(rec.accuracy).toBe(expectAccuracy(20, 25))
      expect(rec.speed).toBe(expectSpeed(120, 60000))
      expect(rec.seconds).toBe(expectSeconds(60000))
    })

    it('meta の各項目（source/mode/level/theme/seed/endCondition/correctCount/date/segStats）をそのまま含む', () => {
      const rec = quizToRecord(args, meta)
      expect(rec.source).toBe('word')
      expect(rec.mode).toBe('quiz-en')
      expect(rec.level).toBe(1)
      expect(rec.theme).toBe('すべて')
      expect(rec.seed).toBe('x')
      expect(rec.endCondition).toEqual({ kind: 'items', value: 25 })
      expect(rec.correctCount).toBe(18) // segStats 由来＝meta 経由で受ける（ビルダー引数ではない）
      expect(rec.date).toBe('2026/01/01')
      expect(rec.segStats).toEqual([])
    })

    it('total は出力フィールドに残さない（words として持ち、total キーは持たない）', () => {
      const rec = quizToRecord(args, meta)
      expect(rec).not.toHaveProperty('total')
    })
  })

  describe('端ケース（quizScore のゼロ割回避を継承）', () => {
    it('total=0 のとき accuracy=0', () => {
      const rec = quizToRecord({ keys: 10, mistakes: 0, correct: 0, total: 0, elapsedMs: 60000 })
      expect(rec.accuracy).toBe(0)
    })

    it('elapsedMs=0 のとき speed=0', () => {
      const rec = quizToRecord({ keys: 10, mistakes: 0, correct: 3, total: 5, elapsedMs: 0 })
      expect(rec.speed).toBe(0)
    })
  })

  describe('純粋・非破壊・非凍結（下流が触れる plain オブジェクト）', () => {
    it('入力 meta を変更しない（非破壊）', () => {
      const meta = { source: 'dict', mode: 'quiz-ja', correctCount: 4 }
      const snapshot = { ...meta }
      quizToRecord({ keys: 30, mistakes: 1, correct: 4, total: 5, elapsedMs: 30000 }, meta)
      expect(meta).toEqual(snapshot)
    })

    it('返り値は凍結しない（Object.isFrozen が false＝saveWordRecord/setRecords が触れる）', () => {
      const rec = quizToRecord({ keys: 30, mistakes: 1, correct: 4, total: 5, elapsedMs: 30000 })
      expect(Object.isFrozen(rec)).toBe(false)
    })
  })

  describe('キー衝突時の優先（スコア/カウント項目が meta より後勝ち）', () => {
    it('meta が keys/accuracy を持っても、算出したスコア値で上書きされる', () => {
      const meta = { keys: 999, accuracy: 5, correct: 999, words: 0 }
      const rec = quizToRecord({ keys: 120, mistakes: 3, correct: 20, total: 25, elapsedMs: 60000 }, meta)
      expect(rec.keys).toBe(120)
      expect(rec.accuracy).toBe(80)
      expect(rec.correct).toBe(20)
      expect(rec.words).toBe(25)
    })
  })
})
