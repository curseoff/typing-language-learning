import { describe, it, expect } from 'vitest'
// #432 P2P穴埋め対戦：サドンデス（ライフ制）。
// 本体 src/domain/versus/suddenDeath.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
import { livesFor, anyoneEliminated } from './suddenDeath.service.js'

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
