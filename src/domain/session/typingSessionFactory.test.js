import { describe, it, expect } from 'vitest'
// #290 Phase 5: Factory（生成のカプセル化）。
// TypingSession Entity の生成手順（採番＋endCondition VO の合成）を一箇所に集約し、
// 「同一性(ID)を外部の生成器から注入する」ことを固定する。
//   - 純ドメインでは ID を作れない（Date/乱数/counter 非依存）ので nextId を注入する。
//   - Factory は nextId() で採番した id と endCondition VO を startTypingSession に渡すだけ＝生成の責務を持つ。
//
// 本体 src/domain/session/typingSession.factory.js は coder が Green で作る（現状未実装＝import で undefined）。
import { createTypingSessionFactory } from './typingSession.factory.js'
// Factory が内部で使う既存部品（生成対象＝Entity と、内包する VO）。
import { makeEndCondition } from './endCondition.vo.js'

// テスト用の妥当な終了条件（十分大きく＝初期状態では終了条件未達）。
const time60 = () => makeEndCondition('time', 60)

// カウンタ式の決定的な ID 生成器（注入用）。s1, s2, s3, … を返す。
function counterIdGen() {
  let i = 0
  return () => `s${++i}`
}

describe('createTypingSessionFactory（Factory の生成・注入検証）', () => {
  describe('nextId（ID 生成器）の検証＝関数注入が必須', () => {
    it('nextId が無い（undefined）と throw する', () => {
      expect(() => createTypingSessionFactory()).toThrow()
    })

    it('nextId が関数でない（文字列）と throw する', () => {
      expect(() => createTypingSessionFactory('s1')).toThrow()
    })

    it('nextId が関数でない（null）と throw する', () => {
      expect(() => createTypingSessionFactory(null)).toThrow()
    })
  })

  describe('factory.start（採番＋VO 合成で Entity を生成）', () => {
    it('注入した nextId() の id を持つ TypingSession を返す', () => {
      const factory = createTypingSessionFactory(() => 'fixed-id')
      const session = factory.start(time60())
      expect(session.id).toBe('fixed-id')
    })

    it('内包する endCondition は渡した VO そのもの（合成）', () => {
      const ec = makeEndCondition('chars', 5)
      const factory = createTypingSessionFactory(() => 's1')
      const session = factory.start(ec)
      expect(session.endCondition).toBe(ec)
    })

    it('生成直後は active・進捗ゼロ（Entity の初期状態）', () => {
      const factory = createTypingSessionFactory(counterIdGen())
      const session = factory.start(time60())
      expect(session.status()).toBe('active')
      expect(session.progress()).toEqual({
        keys: 0,
        mistakes: 0,
        items: 0,
        missedItems: 0,
        elapsedMs: 0,
      })
    })
  })

  describe('同一性は Factory 経由で外部注入される＝連続 start は別 id', () => {
    it('連続 start は nextId の採番順に異なる id を持つ（s1, s2, s3）', () => {
      const factory = createTypingSessionFactory(counterIdGen())
      const a = factory.start(time60())
      const b = factory.start(time60())
      const c = factory.start(time60())
      expect(a.id).toBe('s1')
      expect(b.id).toBe('s2')
      expect(c.id).toBe('s3')
    })

    it('複数セッションの id は互いに重複しない（同一性の不変条件）', () => {
      const factory = createTypingSessionFactory(counterIdGen())
      const ids = [factory.start(time60()).id, factory.start(time60()).id, factory.start(time60()).id]
      expect(new Set(ids).size).toBe(3)
    })
  })

  describe('生成された session は Entity として稼働する', () => {
    it('registerHit() で keys が増える（可変状態を持つ実体）', () => {
      const factory = createTypingSessionFactory(counterIdGen())
      const session = factory.start(time60())
      session.registerHit()
      session.registerHit()
      expect(session.progress().keys).toBe(2)
    })
  })

  describe('endCondition の不正は生成時に throw する（startTypingSession の検証を通す）', () => {
    it('妥当な VO でない終了条件を渡すと throw する', () => {
      const factory = createTypingSessionFactory(counterIdGen())
      // value が不正な生オブジェクト（makeEndCondition を通していない）＝妥当な VO ではない。
      expect(() => factory.start({ kind: 'time', value: 0 })).toThrow()
    })

    it('endCondition を渡さないと throw する', () => {
      const factory = createTypingSessionFactory(counterIdGen())
      expect(() => factory.start()).toThrow()
    })
  })
})
