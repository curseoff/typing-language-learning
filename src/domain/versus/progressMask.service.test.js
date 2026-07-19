import { describe, it, expect } from 'vitest'
// #437 対戦：相手のリアルタイム入力進捗を「伏せ字マスバー」で可視化する純ドメイン。
// 本体 src/domain/versus/progressMask.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
//   maskFill({ curPos, curLen, cap }) … 送信側で実長 curLen を cap マスに量子化（floor）した 0..cap 整数。
//   maskedCells({ fill, cap, state }) … 受信側で fill マスを可視化する長さ cap の配列。
//   segMaskLen({ variants, prefix }) … 現在セグの許容解と正打接頭辞から実長 { curPos, curLen } を導く（量子化前）。
//   PROGRESS_MASK_CAP                … sender/receiver 単一ソースのマス上限（=12）。
import { maskFill, maskedCells, segMaskLen, PROGRESS_MASK_CAP } from './progressMask.service.js'

describe('progressMask（#437・伏せ字マスバー）', () => {
  describe('PROGRESS_MASK_CAP：sender/receiver 単一ソースのマス上限', () => {
    it('マス上限は 12', () => {
      expect(PROGRESS_MASK_CAP).toBe(12)
    })
  })

  describe('maskFill：実長 curLen を cap マスに floor 量子化した 0..cap 整数', () => {
    // (curPos, curLen, cap) → 期待 fill。floor 採用で「未完なら満杯にならない」を保証。
    const cases = [
      ['先頭は 0', 0, 5, 12, 0],
      ['完了は満杯', 5, 5, 12, 12],
      ['1/3 は floor(4)=4', 1, 3, 12, 4],
      ['2/3 は floor(8)=8', 2, 3, 12, 8],
      ['3/3 は満杯', 3, 3, 12, 12],
      ['1/24 は floor(0.5)=0', 1, 24, 12, 0],
      ['23/24 は floor(11.5)=11（未完は満杯にならない＝floorの効能）', 23, 24, 12, 11],
      ['24/24 は満杯', 24, 24, 12, 12],
      ['6/6 は満杯', 6, 6, 12, 12],
      ['curPos>curLen は cap で頭打ち（防御）', 6, 5, 12, 12],
      ['負の curPos は 0（防御）', -1, 5, 12, 0],
      ['curLen=0 は 0', 3, 0, 12, 0],
    ]
    it.each(cases)('%s：(%i,%i,%i)→%i', (_label, curPos, curLen, cap, expected) => {
      expect(maskFill({ curPos, curLen, cap })).toBe(expected)
    })

    it('cap<=0 は防御的に 0 を返す（throw しない）', () => {
      expect(maskFill({ curPos: 3, curLen: 5, cap: 0 })).toBe(0)
      expect(maskFill({ curPos: 3, curLen: 5, cap: -4 })).toBe(0)
    })

    it('curPos<curLen の間は必ず fill<cap（満杯⇔完了の不変条件）', () => {
      const cap = 12
      for (let curLen = 1; curLen <= 40; curLen++) {
        for (let curPos = 0; curPos < curLen; curPos++) {
          expect(maskFill({ curPos, curLen, cap })).toBeLessThan(cap)
        }
        // 完了時のみ満杯。
        expect(maskFill({ curPos: curLen, curLen, cap })).toBe(cap)
      }
    })

    it('返り値は常に 0..cap の整数', () => {
      const cap = 12
      for (let curLen = 1; curLen <= 30; curLen++) {
        for (let curPos = -2; curPos <= curLen + 2; curPos++) {
          const fill = maskFill({ curPos, curLen, cap })
          expect(Number.isInteger(fill)).toBe(true)
          expect(fill).toBeGreaterThanOrEqual(0)
          expect(fill).toBeLessThanOrEqual(cap)
        }
      }
    })
  })

  describe('segMaskLen：許容解 variants と正打接頭辞 prefix から実長 { curPos, curLen } を導く', () => {
    // (variants, prefix) → 期待 { curPos, curLen }。
    //   matching = prefix で始まる variant 群。空なら pool=全 variant、非空なら pool=matching。
    //   curLen = pool の最短長（pool 空なら 0）。curPos = min(prefix.length, curLen)（clamp）。
    const cases = [
      ['未入力は最短解の長さ（両方一致・si=2）', ['shi', 'si'], '', 0, 2],
      ['s は両方一致のまま最短2・curPos=1', ['shi', 'si'], 's', 1, 2],
      ['sh は shi のみ一致＝最短3・curPos=2', ['shi', 'si'], 'sh', 2, 3],
      ['si は完了（満杯相当）＝最短2・curPos=2', ['shi', 'si'], 'si', 2, 2],
      ['shi は完了＝最短3・curPos=3', ['shi', 'si'], 'shi', 3, 3],
      ['どれも prefix で始まらない→pool 全体・最短2・curPos は clamp', ['si'], 'six', 2, 2],
      ['不整合（x）→pool 全体・最短2・curPos=min(1,2)=1', ['shi', 'si'], 'x', 1, 2],
      ['variants 空は curLen=0・curPos=0', [], 'abc', 0, 0],
      ['長い単一解の途中', ['kakikukeko'], 'kaki', 4, 10],
    ]
    it.each(cases)('%s：(%j,%j)→{curPos:%i,curLen:%i}', (_label, variants, prefix, curPos, curLen) => {
      expect(segMaskLen({ variants, prefix })).toEqual({ curPos, curLen })
    })

    it('variants が非配列（null）なら空配列扱い＝{curPos:0, curLen:0}', () => {
      expect(segMaskLen({ variants: null, prefix: 'ab' })).toEqual({ curPos: 0, curLen: 0 })
    })

    it('prefix が非文字列（undefined）なら空文字扱い＝全一致・最短長', () => {
      // '' は全 variant の接頭辞→matching=全体・最短3・curPos=min(0,3)=0。
      expect(segMaskLen({ variants: ['abc', 'abcd'], prefix: undefined })).toEqual({ curPos: 0, curLen: 3 })
    })

    it('curPos は常に curLen 以下（curPos<=curLen の不変条件・maskFill の前提と整合）', () => {
      const samples = [
        { variants: ['shi', 'si'], prefix: '' },
        { variants: ['shi', 'si'], prefix: 's' },
        { variants: ['shi', 'si'], prefix: 'shi' },
        { variants: ['si'], prefix: 'six' },
        { variants: ['shi', 'si'], prefix: 'x' },
        { variants: ['kakikukeko'], prefix: 'kaki' },
        { variants: [], prefix: 'abc' },
        { variants: ['abc', 'abcd'], prefix: undefined },
      ]
      for (const s of samples) {
        const { curPos, curLen } = segMaskLen(s)
        expect(curPos).toBeLessThanOrEqual(curLen)
        expect(curPos).toBeGreaterThanOrEqual(0)
      }
    })

    it('segMaskLen→maskFill 結合：実長は出さずマス化される（curLen=10,curPos=4,cap=12→fill=4）', () => {
      const { curPos, curLen } = segMaskLen({ variants: ['kakikukeko'], prefix: 'kaki' })
      expect({ curPos, curLen }).toEqual({ curPos: 4, curLen: 10 })
      expect(maskFill({ curPos, curLen, cap: 12 })).toBe(4)
    })

    it('segMaskLen→maskFill 結合：完了は満杯（si 完了→fill=cap）', () => {
      const { curPos, curLen } = segMaskLen({ variants: ['shi', 'si'], prefix: 'si' })
      expect({ curPos, curLen }).toEqual({ curPos: 2, curLen: 2 })
      expect(maskFill({ curPos, curLen, cap: 12 })).toBe(12)
    })
  })

  describe('maskedCells：長さ常に cap の可視化配列（filled/pending × state）', () => {
    it('fill=0 は全て pending（長さ cap）', () => {
      const cells = maskedCells({ fill: 0, cap: 12, state: 'ok' })
      expect(cells).toHaveLength(12)
      expect(cells.every((c) => c.kind === 'pending')).toBe(true)
    })

    it('fill=4 は先頭4が filled・残り8が pending', () => {
      const cells = maskedCells({ fill: 4, cap: 12, state: 'ok' })
      expect(cells).toHaveLength(12)
      expect(cells.filter((c) => c.kind === 'filled')).toHaveLength(4)
      expect(cells.filter((c) => c.kind === 'pending')).toHaveLength(8)
      // 先頭 fill 個が filled で、その後 pending という順序。
      expect(cells.slice(0, 4).every((c) => c.kind === 'filled')).toBe(true)
      expect(cells.slice(4).every((c) => c.kind === 'pending')).toBe(true)
    })

    it('fill=cap は全て filled（長さ cap）', () => {
      const cells = maskedCells({ fill: 12, cap: 12, state: 'ok' })
      expect(cells).toHaveLength(12)
      expect(cells.every((c) => c.kind === 'filled')).toBe(true)
    })

    it('state=ok のとき各マスの state は ok', () => {
      const cells = maskedCells({ fill: 5, cap: 12, state: 'ok' })
      expect(cells.every((c) => c.state === 'ok')).toBe(true)
    })

    it('state=miss のとき各マスの state は miss（kind は filled/pending の2種のまま）', () => {
      const cells = maskedCells({ fill: 3, cap: 12, state: 'miss' })
      expect(cells).toHaveLength(12)
      expect(cells.every((c) => c.state === 'miss')).toBe(true)
      // ミス中でも filled/pending の区別は保つ（グリフ種別は2種固定）。
      expect(cells.filter((c) => c.kind === 'filled')).toHaveLength(3)
      expect(cells.filter((c) => c.kind === 'pending')).toHaveLength(9)
      expect(cells.every((c) => c.kind === 'filled' || c.kind === 'pending')).toBe(true)
    })

    it('fill>cap は防御的に cap でクランプ（全て filled）', () => {
      const cells = maskedCells({ fill: 15, cap: 12, state: 'ok' })
      expect(cells).toHaveLength(12)
      expect(cells.filter((c) => c.kind === 'filled')).toHaveLength(12)
      expect(cells.filter((c) => c.kind === 'pending')).toHaveLength(0)
    })

    it('fill<0 は防御的に 0 でクランプ（全て pending）', () => {
      const cells = maskedCells({ fill: -1, cap: 12, state: 'ok' })
      expect(cells).toHaveLength(12)
      expect(cells.filter((c) => c.kind === 'filled')).toHaveLength(0)
      expect(cells.filter((c) => c.kind === 'pending')).toHaveLength(12)
    })

    it('各要素は { kind, state } の形（kind は filled|pending・state は ok|miss）', () => {
      const cells = maskedCells({ fill: 6, cap: 12, state: 'ok' })
      for (const c of cells) {
        expect(['filled', 'pending']).toContain(c.kind)
        expect(['ok', 'miss']).toContain(c.state)
      }
    })
  })
})
