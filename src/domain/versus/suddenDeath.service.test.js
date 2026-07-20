import { describe, it, expect } from 'vitest'
// #432 P2P穴埋め対戦：サドンデス（ライフ制）。
// 本体 src/domain/versus/suddenDeath.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
import {
  livesFor,
  anyoneEliminated,
  suddenDeathOutcome,
} from './suddenDeath.service.js'

describe('suddenDeath（#432・ライフ制）', () => {
  describe('livesFor：残りライフ算出', () => {
    it('missed 数だけライフが減る', () => {
      expect(livesFor(2, 5)).toBe(3)
    })

    it('missed 0 なら満タン（initialLives のまま）', () => {
      expect(livesFor(0, 5)).toBe(5)
    })

    it('ちょうど 0 まで減らせる', () => {
      expect(livesFor(5, 5)).toBe(0)
    })

    it('missed が initialLives を超えても 0 で下げ止まり（負にならない）', () => {
      expect(livesFor(8, 5)).toBe(0)
    })
  })

  describe('anyoneEliminated：誰か脱落（lives<=0）', () => {
    it('誰か1人でも lives<=0 なら true', () => {
      const progress = { a: { lives: 2 }, b: { lives: 0 } }
      expect(anyoneEliminated(progress)).toBe(true)
    })

    it('全員 lives>0 なら false', () => {
      const progress = { a: { lives: 2 }, b: { lives: 1 } }
      expect(anyoneEliminated(progress)).toBe(false)
    })

    it('複数が同時に 0 でも true', () => {
      const progress = { a: { lives: 0 }, b: { lives: 0 } }
      expect(anyoneEliminated(progress)).toBe(true)
    })

    it('負のライフでも脱落扱い（true）', () => {
      const progress = { a: { lives: 3 }, b: { lives: -1 } }
      expect(anyoneEliminated(progress)).toBe(true)
    })

    it('空 map は false', () => {
      expect(anyoneEliminated({})).toBe(false)
    })

    it('lives 欠落の peer は未脱落扱いで無視する', () => {
      const progress = { a: { lives: 2 }, b: {} }
      expect(anyoneEliminated(progress)).toBe(false)
    })
  })
})

// #443 対戦サドンデス（ライフ制）の新しい勝敗判定。
// suddenDeathOutcome(players) : players=[{ id, lives, correct }, ...]（active な全参加者・自分含む）
//   返り値 { status:'won'|'draw'|'ongoing', winnerId?（won のときだけ） }
//   「脱落」= lives<=0。脱落順序に非依存のスナップショット判定。純粋関数。
//   won  : ある P が「他の全員が脱落」かつ「P.correct が他の全員より strict >」
//   draw : 生存者0 かつ 最多 correct が2人以上で並ぶ（唯一の strict 最大なし）
//   ongoing: 上記いずれでもない
describe('suddenDeathOutcome（#443・ライフ制の勝敗判定）', () => {
  describe('1v1', () => {
    it('相手が脱落し自分の correct が勝る（自分は生存でも）→ won（ケース1）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 3 },
        { id: 'b', lives: 2, correct: 5 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'b' })
    })

    it('相手が生存していれば「他全員脱落」を満たさない → ongoing（ケース2）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 5 },
        { id: 'b', lives: 2, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'ongoing' })
    })

    it('両者脱落で B が strict 最大 → won B（ケース3）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 5 },
        { id: 'b', lives: 0, correct: 6 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'b' })
    })

    it('両者脱落で A が strict 最大 → won A（対称性・ケース4）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 5 },
        { id: 'b', lives: 0, correct: 4 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'a' })
    })

    it('両者脱落で同点 → draw（ケース5）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 5 },
        { id: 'b', lives: 0, correct: 5 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'draw' })
    })

    it('両者生存 → ongoing（ケース6）', () => {
      const players = [
        { id: 'a', lives: 3, correct: 2 },
        { id: 'b', lives: 3, correct: 4 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'ongoing' })
    })
  })

  describe('N人（3人）', () => {
    it('B,C が生存 → ongoing（ケース7）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 10 },
        { id: 'b', lives: 2, correct: 5 },
        { id: 'c', lives: 2, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'ongoing' })
    })

    it('C が生存し「他全員脱落」を満たす者が居ない → ongoing（ケース8）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 10 },
        { id: 'b', lives: 0, correct: 4 },
        { id: 'c', lives: 2, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'ongoing' })
    })

    it('全員脱落で A が strict 最大 → won A（ケース9）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 10 },
        { id: 'b', lives: 0, correct: 4 },
        { id: 'c', lives: 0, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'a' })
    })

    it('全員脱落で最多が2人並ぶ → draw（ケース10）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 10 },
        { id: 'b', lives: 0, correct: 10 },
        { id: 'c', lives: 0, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'draw' })
    })

    it('A 生存・他全員脱落・A が strict 最大 → won A（ケース11）', () => {
      const players = [
        { id: 'a', lives: 3, correct: 10 },
        { id: 'b', lives: 0, correct: 4 },
        { id: 'c', lives: 0, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'a' })
    })

    it('A 生存だが A の correct が最大でない → ongoing（ケース12）', () => {
      const players = [
        { id: 'a', lives: 3, correct: 2 },
        { id: 'b', lives: 0, correct: 4 },
        { id: 'c', lives: 0, correct: 3 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'ongoing' })
    })
  })

  describe('端ケース', () => {
    it('空配列 → ongoing', () => {
      expect(suddenDeathOutcome([])).toEqual({ status: 'ongoing' })
    })

    it('単独（N=1・他プレイヤーなし）→ ongoing（vacuous な勝ちにしない）', () => {
      const players = [{ id: 'a', lives: 3, correct: 0 }]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'ongoing' })
    })

    it('負のライフ（lives<0）も脱落として扱う → won', () => {
      const players = [
        { id: 'a', lives: -1, correct: 3 },
        { id: 'b', lives: 2, correct: 5 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'b' })
    })

    it('won のとき winnerId 以外の余計なキーを含まない', () => {
      const players = [
        { id: 'a', lives: 0, correct: 5 },
        { id: 'b', lives: 0, correct: 4 },
      ]
      expect(suddenDeathOutcome(players)).toEqual({ status: 'won', winnerId: 'a' })
    })

    it('ongoing/draw では winnerId を返さない（undefined）', () => {
      const draw = suddenDeathOutcome([
        { id: 'a', lives: 0, correct: 5 },
        { id: 'b', lives: 0, correct: 5 },
      ])
      expect(draw.winnerId).toBeUndefined()
      const ongoing = suddenDeathOutcome([
        { id: 'a', lives: 3, correct: 2 },
        { id: 'b', lives: 3, correct: 4 },
      ])
      expect(ongoing.winnerId).toBeUndefined()
    })

    it('入力配列を破壊しない（非破壊・決定的）', () => {
      const players = [
        { id: 'a', lives: 0, correct: 10 },
        { id: 'b', lives: 0, correct: 4 },
        { id: 'c', lives: 0, correct: 3 },
      ]
      const snapshot = JSON.stringify(players)
      suddenDeathOutcome(players)
      expect(JSON.stringify(players)).toBe(snapshot)
    })
  })
})
