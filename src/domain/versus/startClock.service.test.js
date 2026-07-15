import { describe, it, expect } from 'vitest'
// #426 対戦基盤スライス1：ホストのレース開始時刻を各端末のローカル時刻に換算する。
// localStartTime({ hostStartAt, clockOffsetMs }) → number（= hostStartAt - offset）。
// 本体 src/domain/versus/startClock.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：performance.now()/Date 等を内部で呼ばない＝時刻は引数で受ける・決定的・副作用なし。
import { localStartTime } from './startClock.service.js'

describe('localStartTime（#426・レース開始時刻のローカル換算）', () => {
  describe('基本式：戻り値 = hostStartAt - offset', () => {
    it('offset=0 なら hostStartAt をそのまま返す（10000,0 → 10000）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: 0 })).toBe(10000)
    })

    it('offset 正（自端末が進んでいる）は差し引く（10000,200 → 9800）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: 200 })).toBe(9800)
    })

    it('offset 負（自端末が遅れている）は加算になる（10000,-150 → 10150）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: -150 })).toBe(10150)
    })
  })

  describe('clockOffsetMs が非有限（NaN/undefined/Infinity）は 0 に強制', () => {
    it('NaN は 0 扱い（10000,NaN → 10000）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: NaN })).toBe(10000)
    })

    it('undefined は 0 扱い（10000,undefined → 10000）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: undefined })).toBe(10000)
    })

    it('Infinity は 0 扱い（10000,Infinity → 10000）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: Infinity })).toBe(10000)
    })

    it('-Infinity は 0 扱い（10000,-Infinity → 10000）', () => {
      expect(localStartTime({ hostStartAt: 10000, clockOffsetMs: -Infinity })).toBe(10000)
    })
  })

  describe('hostStartAt が非有限数なら throw（TypeError・VO 自己検証）', () => {
    it('NaN は TypeError を throw', () => {
      expect(() => localStartTime({ hostStartAt: NaN, clockOffsetMs: 0 })).toThrow(TypeError)
    })

    it('Infinity は TypeError を throw', () => {
      expect(() => localStartTime({ hostStartAt: Infinity, clockOffsetMs: 0 })).toThrow(TypeError)
    })

    it('undefined は TypeError を throw', () => {
      expect(() => localStartTime({ hostStartAt: undefined, clockOffsetMs: 0 })).toThrow(TypeError)
    })

    it('非数値（文字列）は TypeError を throw', () => {
      expect(() => localStartTime({ hostStartAt: '10000', clockOffsetMs: 0 })).toThrow(TypeError)
    })
  })

  describe('純粋性・決定的', () => {
    it('同一入力からは何度呼んでも同値', () => {
      const args = { hostStartAt: 12345, clockOffsetMs: 67 }
      expect(localStartTime(args)).toBe(localStartTime(args))
    })

    it('入力オブジェクトを破壊しない', () => {
      const args = { hostStartAt: 10000, clockOffsetMs: 200 }
      localStartTime(args)
      expect(args).toEqual({ hostStartAt: 10000, clockOffsetMs: 200 })
    })
  })
})
