import { describe, it, expect } from 'vitest'
// 未実装の契約A。正本は共有パッケージ @tll/core（packages/core/src/romaji/kanaTable.js）。
// coder が KANA_TABLE/kanaOf/cellOf を実装し @tll/core から export する。
import { KANA_TABLE, kanaOf, cellOf, toRomaji, romajiVariants } from '@tll/core'

// v1 スコープ外の特殊拗音（外来音）。表に含めない番人に使う。
const SPECIAL_YOUON = ['ふぁ', 'ふぃ', 'ふぇ', 'ふぉ', 'ちぇ', 'てぃ', 'とぅ', 'でぃ', 'どぅ', 'ゔ', 'うぃ', 'うぇ', 'つぁ']

describe('KANA_TABLE（契約A: かな表データ）', () => {
  it('先頭はあ行（id=a, group=sei, label=あ行, 5セル）', () => {
    expect(KANA_TABLE[0]).toEqual({
      id: 'a',
      group: 'sei',
      label: 'あ行',
      cells: [
        { kana: 'あ', romaji: 'a' },
        { kana: 'い', romaji: 'i' },
        { kana: 'う', romaji: 'u' },
        { kana: 'え', romaji: 'e' },
        { kana: 'お', romaji: 'o' },
      ],
    })
  })

  it('や行は欠けを null で埋める（[や,null,ゆ,null,よ]）', () => {
    const row = KANA_TABLE.find((r) => r.id === 'ya')
    expect(row.cells).toEqual([
      { kana: 'や', romaji: 'ya' },
      null,
      { kana: 'ゆ', romaji: 'yu' },
      null,
      { kana: 'よ', romaji: 'yo' },
    ])
  })

  it('わ行は [わ,null,null,null,を]', () => {
    const row = KANA_TABLE.find((r) => r.id === 'wa')
    expect(row.cells).toEqual([
      { kana: 'わ', romaji: 'wa' },
      null,
      null,
      null,
      { kana: 'を', romaji: 'wo' },
    ])
  })

  it('ん行は単独の1セル行（romaji=nn）', () => {
    const row = KANA_TABLE.find((r) => r.id === 'n')
    expect(row.cells).toEqual([{ kana: 'ん', romaji: 'nn' }])
  })

  it('行の長さ: 拗音は3・単独んは1・その他は5', () => {
    for (const row of KANA_TABLE) {
      if (row.id === 'n') {
        expect(row.cells.length).toBe(1)
      } else if (row.group === 'youon') {
        expect(row.cells.length).toBe(3)
      } else {
        expect(row.cells.length).toBe(5)
      }
    }
  })

  it('group は清音/濁音/半濁音/拗音のいずれか', () => {
    const groups = new Set(['sei', 'daku', 'handaku', 'youon'])
    for (const row of KANA_TABLE) {
      expect(groups.has(row.group)).toBe(true)
    }
  })

  it('健全性: 全 cell.kana は一意', () => {
    const kanas = KANA_TABLE.flatMap((r) => r.cells).filter(Boolean).map((c) => c.kana)
    expect(new Set(kanas).size).toBe(kanas.length)
  })

  it('健全性: 各 cell.romaji は toRomaji と一致し romajiVariants に含まれる', () => {
    for (const row of KANA_TABLE) {
      for (const cell of row.cells) {
        if (!cell) continue
        expect(cell.romaji).toBe(toRomaji(cell.kana))
        expect(romajiVariants(cell.kana)).toContain(cell.romaji)
      }
    }
  })

  it('スコープ: 特殊拗音（外来音）を表に含めない', () => {
    const kanas = new Set(KANA_TABLE.flatMap((r) => r.cells).filter(Boolean).map((c) => c.kana))
    for (const y of SPECIAL_YOUON) {
      expect(kanas.has(y)).toBe(false)
    }
  })
})

describe('kanaOf（契約A: 行 id 群 → かな平坦化）', () => {
  it('あ行 → あいうえお', () => {
    expect(kanaOf(['a'])).toEqual(['あ', 'い', 'う', 'え', 'お'])
  })

  it('か行+が行 → row-major に10件', () => {
    expect(kanaOf(['ka', 'ga'])).toEqual(['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご'])
  })

  it('null セルは除外する（や行は3件）', () => {
    expect(kanaOf(['ya'])).toEqual(['や', 'ゆ', 'よ'])
  })
})

describe('cellOf（契約A: かな → 逆引き）', () => {
  it('き → {rowId:ka, col:1}', () => {
    expect(cellOf('き')).toEqual({ rowId: 'ka', col: 1 })
  })

  it('ぴょ → {rowId:pya, col:2}', () => {
    expect(cellOf('ぴょ')).toEqual({ rowId: 'pya', col: 2 })
  })

  it('ん → {rowId:n, col:0}', () => {
    expect(cellOf('ん')).toEqual({ rowId: 'n', col: 0 })
  })

  it('表に無いかな（X）は null', () => {
    expect(cellOf('X')).toBe(null)
  })

  it('特殊拗音（てぃ等）は null（スコープ外）', () => {
    expect(cellOf('てぃ')).toBe(null)
    expect(cellOf('ふぁ')).toBe(null)
  })
})
