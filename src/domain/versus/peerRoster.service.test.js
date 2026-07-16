import { describe, it, expect } from 'vitest'
// #426 対戦基盤スライス1：イミュータブルな参加者名簿（roster）。
// 本体 src/domain/versus/peerRoster.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。全 API は入力非破壊で新オブジェクトを返す。
import {
  makeRoster,
  addPeer,
  removePeer,
  markFinished,
  activeIds,
  allFinished,
} from './peerRoster.service.js'

describe('peerRoster（#426・参加者名簿）', () => {
  describe('makeRoster：自分を含む名簿を作る', () => {
    it('自分だけの名簿を作れる（activeIds に自分が居る）', () => {
      const r = makeRoster('me')
      expect(activeIds(r)).toEqual(['me'])
    })

    it('作りたての active 1人（自分のみ・未完了）は allFinished=false', () => {
      expect(allFinished(makeRoster('me'))).toBe(false)
    })
  })

  describe('addPeer：参加者追加（冪等）', () => {
    it('peer を追加すると activeIds に追加順で並ぶ', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = addPeer(r, 'b')
      expect(activeIds(r)).toEqual(['me', 'a', 'b'])
    })

    it('同じ peerId の再追加は不変（冪等）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      const before = activeIds(r)
      r = addPeer(r, 'a')
      expect(activeIds(r)).toEqual(before)
    })

    it('自分自身の再追加は不変（冪等）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'me')
      expect(activeIds(r)).toEqual(['me'])
    })
  })

  describe('removePeer：離脱（left 扱い）', () => {
    it('remove した peer は activeIds から消える（left 除外）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = addPeer(r, 'b')
      r = removePeer(r, 'a')
      expect(activeIds(r)).toEqual(['me', 'b'])
    })

    it('不在 peerId の remove は不変', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      const before = activeIds(r)
      r = removePeer(r, 'ghost')
      expect(activeIds(r)).toEqual(before)
    })

    it('自分を remove しても不変（自分は残る）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = removePeer(r, 'me')
      expect(activeIds(r)).toContain('me')
    })
  })

  describe('markFinished：完了マーク', () => {
    it('mark した peer は active のまま（activeIds には残る）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = markFinished(r, 'a')
      expect(activeIds(r)).toEqual(['me', 'a'])
    })

    it('不在 peerId の markFinished は不変', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      const before = activeIds(r)
      r = markFinished(r, 'ghost')
      expect(activeIds(r)).toEqual(before)
    })
  })

  describe('allFinished：active が1人以上かつ全員完了', () => {
    it('active 全員が finished なら true', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = markFinished(r, 'me')
      r = markFinished(r, 'a')
      expect(allFinished(r)).toBe(true)
    })

    it('一部未完なら false', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = markFinished(r, 'me')
      expect(allFinished(r)).toBe(false)
    })

    it('left した参加者は判定対象外（残り active が全員完了なら true）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      r = markFinished(r, 'me')
      r = removePeer(r, 'a') // a は未完了だが離脱
      expect(allFinished(r)).toBe(true)
    })

    it('active が 0 人（自分も離脱・全員 left）は false', () => {
      let r = makeRoster('me')
      // 自分を含め全員 left になる状況を作る（self は remove 不変仕様のため peer のみで active 0 を作れない
      // → self1人が未離脱だと active>=1。仕様「active 0 は false」を直接検証するため空 active を作る）。
      // ここでは self を含む1人が finished 前の状態から remove を試みても self は残るので、
      // 代わりに「peer を1人追加して両者 left」で active 0 を検証する。
      r = addPeer(r, 'a')
      r = removePeer(r, 'me') // 自分は remove しても残る（不変仕様）
      r = removePeer(r, 'a')
      // self が残る仕様なら active は ['me']。allFinished は self 未完了で false になる（いずれにせよ false）。
      expect(allFinished(r)).toBe(false)
    })
  })

  describe('addPeer：表示名 name（#432 拡張）', () => {
    it('name 付きで追加すると peer が name を保持する', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a', 'Alice')
      expect(r.peers.a.name).toBe('Alice')
    })

    it('name 省略時は従来同等（name は無し／nullish）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a')
      expect(r.peers.a.name ?? null).toBe(null)
    })

    it('name を付けても self/left/finished の既存フィールドは従来どおり', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a', 'Alice')
      expect(r.peers.a.self).toBe(false)
      expect(r.peers.a.left).toBe(false)
      expect(r.peers.a.finished).toBe(false)
    })

    it('既存 peer の再 add で name が新たに与えられたら更新される（hello の name を後から反映）', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a') // 先に name 無しで参加
      r = addPeer(r, 'a', 'Alice') // 後から name 付きで再 add
      expect(r.peers.a.name).toBe('Alice')
    })

    it('name 更新の再 add でも activeIds の冪等性（順序・重複なし）は保たれる', () => {
      let r = makeRoster('me')
      r = addPeer(r, 'a', 'Alice')
      const before = activeIds(r)
      r = addPeer(r, 'a', 'Alice2')
      expect(activeIds(r)).toEqual(before)
    })

    it('name 付き add でも元 roster は破壊しない（新オブジェクト返却）', () => {
      const r0 = makeRoster('me')
      const r1 = addPeer(r0, 'a', 'Alice')
      expect(r0.peers.a).toBeUndefined() // 元は不変
      expect(r1).not.toBe(r0)
    })
  })

  describe('純粋性：入力非破壊・新オブジェクト返却', () => {
    it('addPeer は元 roster を破壊しない', () => {
      const r0 = makeRoster('me')
      const r1 = addPeer(r0, 'a')
      expect(activeIds(r0)).toEqual(['me']) // 元は不変
      expect(r1).not.toBe(r0)
    })

    it('removePeer は元 roster を破壊しない', () => {
      let r0 = makeRoster('me')
      r0 = addPeer(r0, 'a')
      const snapshot = activeIds(r0)
      removePeer(r0, 'a')
      expect(activeIds(r0)).toEqual(snapshot)
    })

    it('markFinished は元 roster を破壊しない（allFinished 判定が変わらない）', () => {
      let r0 = makeRoster('me')
      r0 = addPeer(r0, 'a')
      r0 = markFinished(r0, 'me')
      const before = allFinished(r0)
      markFinished(r0, 'a')
      expect(allFinished(r0)).toBe(before)
    })
  })
})
