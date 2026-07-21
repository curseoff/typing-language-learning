import { describe, it, expect } from 'vitest'
// #443 対戦：「相手の完了を待っています…」の待機メッセージを表示すべきかの判定。
// 本体 src/domain/versus/waitingState.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。
import { shouldWaitForOthers } from './waitingState.service.js'

// shouldWaitForOthers({ phase, selfFinished, allFinished }) -> boolean
//   true になるのは phase==='running' かつ selfFinished===true かつ allFinished===false のときだけ。
//   phase は matchState.service の遷移表の語彙（waiting/connecting/countdown/running/finished）。
//   不正・欠落入力は throw せず false（安全側＝迷ったら出さない）。
describe('shouldWaitForOthers（#443・相手待ちメッセージの表示可否）', () => {
  describe('phase=running の真理値表', () => {
    it('自分が完了・全員は未完了なら待機メッセージを出す', () => {
      expect(shouldWaitForOthers({ phase: 'running', selfFinished: true, allFinished: false })).toBe(
        true,
      )
    })

    it('自分がまだ完了していなければ出さない', () => {
      expect(
        shouldWaitForOthers({ phase: 'running', selfFinished: false, allFinished: false }),
      ).toBe(false)
    })

    it('全員完了なら待つ相手がいないので出さない', () => {
      expect(shouldWaitForOthers({ phase: 'running', selfFinished: true, allFinished: true })).toBe(
        false,
      )
    })

    it('自分未完了かつ全員完了という矛盾入力でも出さない', () => {
      expect(shouldWaitForOthers({ phase: 'running', selfFinished: false, allFinished: true })).toBe(
        false,
      )
    })
  })

  describe('対戦終了後は常に出さない（#443 の不具合そのもの）', () => {
    it('finished なら自分完了・全員未完了でも出さない（サドンデス決着後の取りこぼし）', () => {
      expect(
        shouldWaitForOthers({ phase: 'finished', selfFinished: true, allFinished: false }),
      ).toBe(false)
    })

    it('finished かつ全員完了でも出さない', () => {
      expect(shouldWaitForOthers({ phase: 'finished', selfFinished: true, allFinished: true })).toBe(
        false,
      )
    })

    it('finished かつ自分未完了（脱落で終了）でも出さない', () => {
      expect(
        shouldWaitForOthers({ phase: 'finished', selfFinished: false, allFinished: false }),
      ).toBe(false)
    })
  })

  describe('レース開始前の phase は安全側で false', () => {
    it('countdown では自分完了扱いでも出さない', () => {
      expect(
        shouldWaitForOthers({ phase: 'countdown', selfFinished: true, allFinished: false }),
      ).toBe(false)
    })

    it('waiting では出さない', () => {
      expect(
        shouldWaitForOthers({ phase: 'waiting', selfFinished: true, allFinished: false }),
      ).toBe(false)
    })

    it('connecting では出さない', () => {
      expect(
        shouldWaitForOthers({ phase: 'connecting', selfFinished: true, allFinished: false }),
      ).toBe(false)
    })
  })

  describe('selfFinished は真の真偽値 true のときだけ待機とみなす', () => {
    it('selfFinished 省略なら出さない', () => {
      expect(shouldWaitForOthers({ phase: 'running', allFinished: false })).toBe(false)
    })

    it('selfFinished が null なら出さない', () => {
      expect(
        shouldWaitForOthers({ phase: 'running', selfFinished: null, allFinished: false }),
      ).toBe(false)
    })
  })

  describe('allFinished は真の真偽値 true のときだけ「待つ相手なし」とみなす', () => {
    it('allFinished 省略なら未完了扱いで出す', () => {
      expect(shouldWaitForOthers({ phase: 'running', selfFinished: true })).toBe(true)
    })

    it('allFinished が undefined なら未完了扱いで出す', () => {
      expect(
        shouldWaitForOthers({ phase: 'running', selfFinished: true, allFinished: undefined }),
      ).toBe(true)
    })
  })

  describe('不正・欠落入力は throw せず false（安全側）', () => {
    it('phase が未知の文字列なら false', () => {
      expect(
        shouldWaitForOthers({ phase: 'playing', selfFinished: true, allFinished: false }),
      ).toBe(false)
    })

    it('phase が undefined なら false', () => {
      expect(
        shouldWaitForOthers({ phase: undefined, selfFinished: true, allFinished: false }),
      ).toBe(false)
    })

    it('phase が null なら false', () => {
      expect(shouldWaitForOthers({ phase: null, selfFinished: true, allFinished: false })).toBe(
        false,
      )
    })

    it('phase が数値なら false', () => {
      expect(shouldWaitForOthers({ phase: 1, selfFinished: true, allFinished: false })).toBe(false)
    })

    it('空オブジェクトなら false', () => {
      expect(shouldWaitForOthers({})).toBe(false)
    })

    it('引数なしでも throw せず false', () => {
      expect(() => shouldWaitForOthers()).not.toThrow()
      expect(shouldWaitForOthers()).toBe(false)
    })

    it('引数が undefined／null でも throw せず false', () => {
      expect(shouldWaitForOthers(undefined)).toBe(false)
      expect(shouldWaitForOthers(null)).toBe(false)
    })

    it('引数が数値でも throw せず false', () => {
      expect(() => shouldWaitForOthers(1)).not.toThrow()
      expect(shouldWaitForOthers(1)).toBe(false)
    })
  })

  describe('純粋性', () => {
    it('同じ入力に対して常に同じ結果を返す（決定的）', () => {
      const args = { phase: 'running', selfFinished: true, allFinished: false }
      expect(shouldWaitForOthers(args)).toBe(shouldWaitForOthers(args))
      expect(
        shouldWaitForOthers({ phase: 'finished', selfFinished: true, allFinished: false }),
      ).toBe(shouldWaitForOthers({ phase: 'finished', selfFinished: true, allFinished: false }))
    })

    it('引数オブジェクトを破壊しない', () => {
      const args = { phase: 'finished', selfFinished: true, allFinished: false }
      const snapshot = JSON.stringify(args)
      shouldWaitForOthers(args)
      expect(JSON.stringify(args)).toBe(snapshot)
    })
  })
})
