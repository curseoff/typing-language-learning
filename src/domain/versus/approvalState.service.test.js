import { describe, it, expect } from 'vitest'
// #432 P2P穴埋め対戦：承認フローの純状態機械。
// 本体 src/domain/versus/approvalState.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。全 API は入力非破壊で新オブジェクトを返す。
//
// votes は { [peerId]: 'pending'|'accept'|'reject' }。proposer は初期から 'accept'、他メンバーは 'pending'。
import {
  initApproval,
  castVote,
  isAllAccepted,
  isRejected,
  rejectedBy,
  removeMember,
} from './approvalState.service.js'

const CONFIG = { blanks: 3, timeLimit: 60 }

describe('approvalState（#432・承認フロー状態機械）', () => {
  describe('initApproval：初期状態', () => {
    it('phase=proposed で proposer・config を保持する', () => {
      const s = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      expect(s.phase).toBe('proposed')
      expect(s.proposer).toBe('me')
      expect(s.config).toEqual(CONFIG)
    })

    it('proposer は初期から accept・他メンバーは pending', () => {
      const s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      expect(s.votes).toEqual({ me: 'accept', a: 'pending', b: 'pending' })
    })

    it('memberIds は全参加者（proposer 含む）を votes に持つ', () => {
      const s = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      expect(Object.keys(s.votes).sort()).toEqual(['a', 'me'])
    })

    it('proposer 単独なら初期から全員 accept（isAllAccepted=true）', () => {
      const s = initApproval({ config: CONFIG, memberIds: ['me'], proposer: 'me' })
      expect(isAllAccepted(s)).toBe(true)
    })
  })

  describe('castVote：投票の反映', () => {
    it('accept を反映して該当 peer の vote が accept になる', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = castVote(s0, 'a', 'accept')
      expect(s1.votes.a).toBe('accept')
    })

    it('reject を反映して該当 peer の vote が reject になる', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = castVote(s0, 'a', 'reject')
      expect(s1.votes.a).toBe('reject')
    })

    it('accept/reject 以外の無効な vote は無視して等価な votes を返す', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = castVote(s0, 'a', 'maybe')
      expect(s1.votes).toEqual(s0.votes)
    })

    it('members 外の未知 peerId は無視して等価な votes を返す', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = castVote(s0, 'ghost', 'accept')
      expect(s1.votes).toEqual(s0.votes)
    })

    it('再投票は上書きできる（reject→accept）', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = castVote(s0, 'a', 'reject')
      const s2 = castVote(s1, 'a', 'accept')
      expect(s2.votes.a).toBe('accept')
    })

    it('元 state を破壊しない（新オブジェクトを返す）', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = castVote(s0, 'a', 'accept')
      expect(s0.votes.a).toBe('pending') // 元は不変
      expect(s1).not.toBe(s0)
    })
  })

  describe('isAllAccepted：全メンバー accept', () => {
    it('全メンバーが accept なら true', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = castVote(s, 'a', 'accept')
      s = castVote(s, 'b', 'accept')
      expect(isAllAccepted(s)).toBe(true)
    })

    it('一部 pending が残ると false', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = castVote(s, 'a', 'accept')
      expect(isAllAccepted(s)).toBe(false)
    })

    it('reject が混ざると false', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      s = castVote(s, 'a', 'reject')
      expect(isAllAccepted(s)).toBe(false)
    })
  })

  describe('isRejected / rejectedBy：拒否の検知', () => {
    it('誰も reject していなければ isRejected=false・rejectedBy は空配列', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      s = castVote(s, 'a', 'accept')
      expect(isRejected(s)).toBe(false)
      expect(rejectedBy(s)).toEqual([])
    })

    it('誰か1人でも reject すれば isRejected=true', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = castVote(s, 'a', 'reject')
      expect(isRejected(s)).toBe(true)
    })

    it('rejectedBy は reject した peerId をすべて返す', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = castVote(s, 'a', 'reject')
      s = castVote(s, 'b', 'reject')
      expect(rejectedBy(s).sort()).toEqual(['a', 'b'])
    })
  })

  describe('removeMember：離脱者を集計から除外', () => {
    it('離脱者を votes から除外する', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = removeMember(s, 'b')
      expect(Object.keys(s.votes).sort()).toEqual(['a', 'me'])
    })

    it('離脱者を除外した残りが全員 accept なら isAllAccepted=true', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = castVote(s, 'a', 'accept')
      // b は pending のまま離脱 → 残り me/a が accept
      s = removeMember(s, 'b')
      expect(isAllAccepted(s)).toBe(true)
    })

    it('reject 者が離脱すれば isRejected=false に戻る', () => {
      let s = initApproval({ config: CONFIG, memberIds: ['me', 'a', 'b'], proposer: 'me' })
      s = castVote(s, 'b', 'reject')
      s = removeMember(s, 'b')
      expect(isRejected(s)).toBe(false)
    })

    it('存在しない peer の removeMember は等価な votes を返す', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = removeMember(s0, 'ghost')
      expect(s1.votes).toEqual(s0.votes)
    })

    it('元 state を破壊しない（新オブジェクトを返す）', () => {
      const s0 = initApproval({ config: CONFIG, memberIds: ['me', 'a'], proposer: 'me' })
      const s1 = removeMember(s0, 'a')
      expect(Object.keys(s0.votes).sort()).toEqual(['a', 'me']) // 元は不変
      expect(s1).not.toBe(s0)
    })
  })
})
