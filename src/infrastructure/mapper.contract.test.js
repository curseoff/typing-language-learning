// 既存の Mapper（.mapper.js）を共通契約（assertMapper）に載せるメタテスト。#337。
// Mapper は「列⇄record の純双方向コーデック」＝往復不変・決定的・非破壊で、DB/IO には依存しない。
// null↔undefined を「不在」として等価に扱い、value を持たない終了条件（endless）は value キーを作らない。
// ファイル名は .contract.test.js ＝命名メタテスト（.mapper.js サフィックス強制）の対象外。
import { describe, it, expect } from 'vitest'
import { assertMapper } from '../test/contracts/mapper.js'
import {
  ecToColumns,
  ecFromRow,
  jsonToColumn,
  jsonFromColumn,
  assign,
} from './db/repos/_codec.mapper.js'

describe('Mapper契約: ecColumns(time)', () =>
  assertMapper({
    toColumns: ecToColumns,
    fromRow: ecFromRow,
    sample: () => ({ kind: 'time', value: 60 }),
  }))

describe('Mapper契約: ecColumns(endless＝value 無し)', () =>
  assertMapper({
    toColumns: ecToColumns,
    fromRow: ecFromRow,
    sample: () => ({ kind: 'endless' }), // 往復で {kind:'endless'} に戻る＝value キーを作らない
  }))

describe('Mapper契約: jsonColumn', () =>
  assertMapper({
    toColumns: jsonToColumn,
    fromRow: jsonFromColumn,
    sample: () => ({ a: 1, b: [2, 3], c: 'x' }),
  }))

describe('Mapper: assign の意味（存在するときだけプロパティを立てる）', () => {
  it('val が 0 や "" でもプロパティを立てる（!= null は 0/"" を通す）', () => {
    const o = {}
    assign(o, 'k', 0)
    expect(o).toEqual({ k: 0 })
    assign(o, 's', '')
    expect(o).toEqual({ k: 0, s: '' })
  })

  it('val が null・undefined ではプロパティを立てない', () => {
    const o = {}
    assign(o, 'k', 0)
    assign(o, 'n', null)
    assign(o, 'u', undefined)
    expect(o).toEqual({ k: 0 })
  })
})

describe('Mapper: 不在の等価（null↔undefined）', () => {
  it('ecFromRow(ecToColumns(null)) は undefined（不在として往復する）', () => {
    expect(ecFromRow(ecToColumns(null))).toBeUndefined()
  })
})
