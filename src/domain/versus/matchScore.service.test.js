import { describe, it, expect } from 'vitest'
// #432 P2P穴埋め対戦：勝敗判定（N人・正解問題数のみで判定）。
// 本体 src/domain/versus/matchScore.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
//
// scores は { [peerId]: { correct, ... } }。correct のみで判定し、他フィールド（speed/mistakes/time 等）は無視する。
import { rankByCorrect, winners } from './matchScore.service.js'

describe('matchScore（#432・勝敗判定）', () => {
  describe('rankByCorrect：correct 降順の順位', () => {
    it('correct 降順で [{peerId, correct}] を返す', () => {
      const scores = { a: { correct: 3 }, b: { correct: 5 }, c: { correct: 1 } }
      expect(rankByCorrect(scores)).toEqual([
        { peerId: 'b', correct: 5 },
        { peerId: 'a', correct: 3 },
        { peerId: 'c', correct: 1 },
      ])
    })

    it('correct 以外のフィールド（speed/time 等）があっても結果は correct のみで決まる', () => {
      const scores = {
        a: { correct: 2, speed: 999, time: 1 },
        b: { correct: 4, speed: 0, mistakes: 10 },
      }
      expect(rankByCorrect(scores)).toEqual([
        { peerId: 'b', correct: 4 },
        { peerId: 'a', correct: 2 },
      ])
    })

    it('空 scores は空配列を返す', () => {
      expect(rankByCorrect({})).toEqual([])
    })

    it('同数の並びは安定（入力の列挙順を保つ）', () => {
      const scores = { a: { correct: 3 }, b: { correct: 3 }, c: { correct: 5 } }
      const ranked = rankByCorrect(scores)
      expect(ranked[0]).toEqual({ peerId: 'c', correct: 5 })
      // a と b は同数 → 入力の列挙順（a→b）を保つ
      expect(ranked.slice(1)).toEqual([
        { peerId: 'a', correct: 3 },
        { peerId: 'b', correct: 3 },
      ])
    })
  })

  describe('winners：correct 最多の peerId 配列', () => {
    it('単独最多なら勝者は1人', () => {
      const scores = { a: { correct: 3 }, b: { correct: 5 }, c: { correct: 1 } }
      expect(winners(scores)).toEqual(['b'])
    })

    it('同数最多が2人ならドロー（両方返す）', () => {
      const scores = { a: { correct: 5 }, b: { correct: 5 }, c: { correct: 1 } }
      expect(winners(scores).sort()).toEqual(['a', 'b'])
    })

    it('同数最多が3人ならドロー（3人返す）', () => {
      const scores = { a: { correct: 4 }, b: { correct: 4 }, c: { correct: 4 } }
      expect(winners(scores).sort()).toEqual(['a', 'b', 'c'])
    })

    it('全員0でも最多（=0）の全員を返す', () => {
      const scores = { a: { correct: 0 }, b: { correct: 0 } }
      expect(winners(scores).sort()).toEqual(['a', 'b'])
    })

    it('空 scores は空配列を返す', () => {
      expect(winners({})).toEqual([])
    })

    it('correct 以外（mistakes/time）は勝敗に影響しない', () => {
      const scores = {
        a: { correct: 5, mistakes: 100, time: 999 },
        b: { correct: 5, mistakes: 0, time: 1 },
      }
      expect(winners(scores).sort()).toEqual(['a', 'b'])
    })
  })
})
