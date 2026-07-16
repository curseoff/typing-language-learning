import { describe, it, expect } from 'vitest'
// #432 P2P穴埋め対戦：勝敗判定（N人・正解問題数のみで判定）。
// 本体 src/domain/versus/matchScore.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
//
// scores は { [peerId]: { correct, ... } }。correct のみで判定し、他フィールド（speed/mistakes/time 等）は無視する。
import { rankByCorrect, winners, rankMap } from './matchScore.service.js'

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

  // #432 不具合④（順位表示）：競技順位（同点は同順位・次順位は飛ぶ）を peerId→rank で返す。
  // rank = 1 + (自分より correct が真に大きい人数)。1始まり整数。
  describe('rankMap：peerId→順位（競技順位・同点は同順位）', () => {
    it('全員 correct が異なるとき 1位/2位/3位 を割り当てる', () => {
      const scores = { a: { correct: 3 }, b: { correct: 5 }, c: { correct: 1 } }
      expect(rankMap(scores)).toEqual({ a: 2, b: 1, c: 3 })
    })

    it('単独1位・単独2位（2人）', () => {
      const scores = { a: { correct: 19 }, b: { correct: 9 } }
      expect(rankMap(scores)).toEqual({ a: 1, b: 2 })
    })

    it('同点2人は同順位（両者1位）', () => {
      const scores = { a: { correct: 5 }, b: { correct: 5 } }
      expect(rankMap(scores)).toEqual({ a: 1, b: 1 })
    })

    it('同点1位が2人・次順位は飛ぶ（1,1,3）', () => {
      const scores = { a: { correct: 5 }, b: { correct: 5 }, c: { correct: 3 } }
      expect(rankMap(scores)).toEqual({ a: 1, b: 1, c: 3 })
    })

    it('同点3人は全員同順位（1,1,1）', () => {
      const scores = { a: { correct: 4 }, b: { correct: 4 }, c: { correct: 4 } }
      expect(rankMap(scores)).toEqual({ a: 1, b: 1, c: 1 })
    })

    it('全員同点（0含む）なら全員1位', () => {
      const scores = { a: { correct: 0 }, b: { correct: 0 }, c: { correct: 0 } }
      expect(rankMap(scores)).toEqual({ a: 1, b: 1, c: 1 })
    })

    it('空 scores は空オブジェクト', () => {
      expect(rankMap({})).toEqual({})
    })

    it('correct 以外のフィールド（speed/mistakes/time）は順位に影響しない', () => {
      const scores = {
        a: { correct: 2, speed: 999, mistakes: 0 },
        b: { correct: 4, speed: 0, mistakes: 10 },
        c: { correct: 4, speed: 500, time: 1 },
      }
      // b と c は同点で同順位（1位）、a は 3位（2人が真に大きい）
      expect(rankMap(scores)).toEqual({ a: 3, b: 1, c: 1 })
    })
  })
})
