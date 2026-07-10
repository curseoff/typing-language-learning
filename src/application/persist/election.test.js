import { describe, it, expect } from 'vitest'
// #273 Phase3b: Web Locks 主タブ選出の状態遷移（純関数・DOM/infra 非依存）。
// coder が後で Green にする src/application/persist/election.js を対象にする。
// state = { role: 'unknown'|'primary'|'secondary', epoch: number }
// event = { type:'lock-granted' } | { type:'lock-unavailable' } | { type:'promote-granted' }
import { electionTransition } from './election.policy.js'

describe('electionTransition（主タブ選出の状態遷移・純関数）', () => {
  describe('unknown 状態からの遷移', () => {
    it('unknown + lock-granted で primary へ昇格し epoch を +1 する', () => {
      expect(electionTransition({ role: 'unknown', epoch: 0 }, { type: 'lock-granted' })).toEqual({
        role: 'primary',
        epoch: 1,
      })
    })

    it('unknown + lock-unavailable で secondary になり epoch は据え置き', () => {
      expect(
        electionTransition({ role: 'unknown', epoch: 5 }, { type: 'lock-unavailable' }),
      ).toEqual({ role: 'secondary', epoch: 5 })
    })
  })

  describe('secondary 状態からの遷移', () => {
    it('secondary + promote-granted で primary へ昇格し epoch を +1 する（handoff 昇格）', () => {
      expect(
        electionTransition({ role: 'secondary', epoch: 3 }, { type: 'promote-granted' }),
      ).toEqual({ role: 'primary', epoch: 4 })
    })

    it('secondary + lock-unavailable は secondary のまま据え置き（冪等）', () => {
      expect(
        electionTransition({ role: 'secondary', epoch: 3 }, { type: 'lock-unavailable' }),
      ).toEqual({ role: 'secondary', epoch: 3 })
    })

    // 仕様固定: secondary は promote-granted 経由でのみ primary 化する。
    // secondary + lock-granted は通常来ない想定 → 無視して secondary/epoch 据え置き。
    it('secondary + lock-granted は無視して secondary のまま据え置き（昇格は promote-granted 経由のみ）', () => {
      expect(
        electionTransition({ role: 'secondary', epoch: 3 }, { type: 'lock-granted' }),
      ).toEqual({ role: 'secondary', epoch: 3 })
    })
  })

  describe('primary 状態からの遷移（冪等・降格しない）', () => {
    it('primary + lock-granted は primary のまま epoch 据え置き', () => {
      expect(electionTransition({ role: 'primary', epoch: 2 }, { type: 'lock-granted' })).toEqual({
        role: 'primary',
        epoch: 2,
      })
    })

    it('primary + promote-granted は primary のまま epoch 据え置き（重複昇格しない）', () => {
      expect(
        electionTransition({ role: 'primary', epoch: 2 }, { type: 'promote-granted' }),
      ).toEqual({ role: 'primary', epoch: 2 })
    })

    it('primary + lock-unavailable でも降格せず primary のまま（生存中は降格なし）', () => {
      expect(
        electionTransition({ role: 'primary', epoch: 2 }, { type: 'lock-unavailable' }),
      ).toEqual({ role: 'primary', epoch: 2 })
    })
  })

  describe('不変条件', () => {
    it('primary 化のたびに epoch は単調増加する（unknown→primary→…→handoff の連鎖）', () => {
      const s0 = { role: 'unknown', epoch: 0 }
      const s1 = electionTransition(s0, { type: 'lock-granted' }) // primary, 1
      expect(s1.epoch).toBe(1)
      // 別タブが secondary から昇格する場面を想定（epoch は state を引き継いで +1）。
      const t0 = { role: 'secondary', epoch: 1 }
      const t1 = electionTransition(t0, { type: 'promote-granted' })
      expect(t1.epoch).toBeGreaterThan(t0.epoch)
    })

    it('生存中に primary から secondary への降格は起きない（全 event で primary 維持）', () => {
      const events = [
        { type: 'lock-granted' },
        { type: 'lock-unavailable' },
        { type: 'promote-granted' },
      ]
      for (const ev of events) {
        expect(electionTransition({ role: 'primary', epoch: 9 }, ev).role).toBe('primary')
      }
    })

    it('入力 state を破壊しない（新オブジェクトを返す）', () => {
      const state = { role: 'unknown', epoch: 0 }
      const next = electionTransition(state, { type: 'lock-granted' })
      expect(state).toEqual({ role: 'unknown', epoch: 0 }) // 元は不変
      expect(next).not.toBe(state) // 別インスタンス
    })
  })
})
