// かな五十音表 VO（KANA_TABLE 定数＋kanaOf/cellOf 純アクセサ）の契約テスト。#383。
// KANA_TABLE は make*/*Equals 形のファクトリ VO ではなく「deep-freeze 済みの不変定数テーブル＋純関数」。
// 値等価契約（valueObject.contract）の形に載らないので、ここで
//   - 不変：deep-freeze（表・各行・cells 配列・各 cell が Object.isFrozen）
//   - kanaOf：決定性・非破壊・存在しない行 id は無視
//   - cellOf：決定性・表にある kana は { rowId, col }・表に無い kana は null
// を検証する。packages 側テストは root vitest の include（packages/*/src/**/*.test.{ts,tsx}）に合わせ .ts。
import { describe, it, expect } from 'vitest'
import { KANA_TABLE, kanaOf, cellOf } from './kanaTable.vo.js'

describe('kanaTable 契約: 不変（deep-freeze）', () => {
  // #383: deep-freeze を再帰的に検証する共有ヘルパ（assertFrozenDeep）は coder が作る。
  // 現状は未整備なので dynamic import が解決に失敗し、この it だけが赤になる（未実装ゆえの Red）。
  // ヘルパ実装後は、KANA_TABLE が既に表・各行・cells 配列・各 cell まで凍結済みなので緑になる。
  it('KANA_TABLE は表・各行・cells 配列・各 cell まで deep-freeze されている', async () => {
    const { assertFrozenDeep } = await import('../../../../src/test/contracts/frozen.js')
    assertFrozenDeep(KANA_TABLE)
  })
})

describe('kanaTable 契約: kanaOf', () => {
  it('決定的：同じ入力からは同じ出力を返す', () => {
    expect(kanaOf(['a', 'ka'])).toEqual(kanaOf(['a', 'ka']))
  })

  it('行 id 群を row-major・null 除外で平坦化する', () => {
    expect(kanaOf(['a'])).toEqual(['あ', 'い', 'う', 'え', 'お'])
    // や行は ['や', null, 'ゆ', null, 'よ'] ＝ null を除外して平坦化する
    expect(kanaOf(['ya'])).toEqual(['や', 'ゆ', 'よ'])
  })

  it('非破壊：入力の rowIds 配列を変更しない', () => {
    const ids = ['a', 'ya']
    const before = [...ids]
    kanaOf(ids)
    expect(ids).toEqual(before)
  })

  it('存在しない行 id は無視する', () => {
    expect(kanaOf(['a', 'zzz'])).toEqual(kanaOf(['a']))
    expect(kanaOf(['nope'])).toEqual([])
  })
})

describe('kanaTable 契約: cellOf', () => {
  it('決定的：同じ kana からは同じ結果を返す', () => {
    expect(cellOf('あ')).toEqual(cellOf('あ'))
  })

  it('表にある kana には { rowId, col } を返す', () => {
    expect(cellOf('あ')).toEqual({ rowId: 'a', col: 0 })
    expect(cellOf('こ')).toEqual({ rowId: 'ka', col: 4 })
    expect(cellOf('ゆ')).toEqual({ rowId: 'ya', col: 2 })
  })

  it('表に無い kana（小書き ぁ・特殊拗音 ふぁ・空文字）は null', () => {
    expect(cellOf('ぁ')).toBeNull()
    expect(cellOf('ふぁ')).toBeNull()
    expect(cellOf('')).toBeNull()
  })
})
