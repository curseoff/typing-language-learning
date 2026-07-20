import { describe, it, expect } from 'vitest'
// #443 対戦：自分の盤面がキー入力を受け付けてよいかの判定。
// 本体 src/domain/versus/boardActivity.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。
import { isBoardActive } from './boardActivity.service.js'

// isBoardActive({ phase, eliminated }) -> boolean
//   true になるのは phase==='running' かつ eliminated!==true のときだけ。
//   phase は matchState.service の遷移表の語彙（waiting/connecting/countdown/running/finished）。
//   不正・欠落入力は throw せず false（安全側＝レース開始前/終了後に打てない）。
describe('isBoardActive（#443・盤面の入力可否）', () => {
  describe('phase=running の真理値表', () => {
    it('running かつ未脱落（eliminated=false）なら入力できる', () => {
      expect(isBoardActive({ phase: 'running', eliminated: false })).toBe(true)
    })

    it('running でも脱落済み（eliminated=true）なら入力できない', () => {
      expect(isBoardActive({ phase: 'running', eliminated: true })).toBe(false)
    })

    it('running で eliminated 省略なら「脱落していない」扱いで入力できる', () => {
      expect(isBoardActive({ phase: 'running' })).toBe(true)
    })
  })

  describe('対戦終了後（#443 の不具合そのもの）', () => {
    it('finished なら未脱落（勝者）でも入力できない', () => {
      expect(isBoardActive({ phase: 'finished', eliminated: false })).toBe(false)
    })

    it('finished かつ脱落済みでも入力できない', () => {
      expect(isBoardActive({ phase: 'finished', eliminated: true })).toBe(false)
    })

    it('finished で eliminated 省略でも入力できない（phase が優先）', () => {
      expect(isBoardActive({ phase: 'finished' })).toBe(false)
    })
  })

  describe('レース開始前の phase は安全側で false', () => {
    it('countdown では未脱落でも入力できない', () => {
      expect(isBoardActive({ phase: 'countdown', eliminated: false })).toBe(false)
    })

    it('waiting では入力できない', () => {
      expect(isBoardActive({ phase: 'waiting', eliminated: false })).toBe(false)
    })

    it('connecting では入力できない', () => {
      expect(isBoardActive({ phase: 'connecting', eliminated: false })).toBe(false)
    })
  })

  describe('脱落フラグは phase によらず入力を止める', () => {
    it('eliminated=true なら countdown でも false', () => {
      expect(isBoardActive({ phase: 'countdown', eliminated: true })).toBe(false)
    })

    it('eliminated=true なら phase 欠落でも false', () => {
      expect(isBoardActive({ eliminated: true })).toBe(false)
    })
  })

  describe('不正・欠落入力は throw せず false（安全側）', () => {
    it('phase が未知の文字列なら false', () => {
      expect(isBoardActive({ phase: 'playing', eliminated: false })).toBe(false)
    })

    it('phase が undefined なら false', () => {
      expect(isBoardActive({ phase: undefined, eliminated: false })).toBe(false)
    })

    it('phase が null なら false', () => {
      expect(isBoardActive({ phase: null, eliminated: false })).toBe(false)
    })

    it('phase が数値なら false', () => {
      expect(isBoardActive({ phase: 1, eliminated: false })).toBe(false)
    })

    it('空オブジェクトなら false', () => {
      expect(isBoardActive({})).toBe(false)
    })

    it('引数なしでも throw せず false', () => {
      expect(() => isBoardActive()).not.toThrow()
      expect(isBoardActive()).toBe(false)
    })

    it('引数が undefined／null でも throw せず false', () => {
      expect(isBoardActive(undefined)).toBe(false)
      expect(isBoardActive(null)).toBe(false)
    })
  })

  describe('純粋性', () => {
    it('同じ入力に対して常に同じ結果を返す（決定的）', () => {
      const args = { phase: 'running', eliminated: false }
      expect(isBoardActive(args)).toBe(isBoardActive(args))
      expect(isBoardActive({ phase: 'finished', eliminated: false })).toBe(
        isBoardActive({ phase: 'finished', eliminated: false }),
      )
    })

    it('引数オブジェクトを破壊しない', () => {
      const args = { phase: 'finished', eliminated: false }
      const snapshot = JSON.stringify(args)
      isBoardActive(args)
      expect(JSON.stringify(args)).toBe(snapshot)
    })
  })
})
