// #450 対戦の学習統計を通常プレイと区別する（Red）。
// 対戦由来の item-stats を通常プレイと別 id に積むための接頭辞生成 statPrefix(base, versus) の仕様。
// 「分けて持ち、合算で見せる」方針なので、ここで決まるのは「書き込み先の id をどう分けるか」だけ。
//
// 最大の制約は infrastructure/db/repos/itemStats.repository.js の splitId が
// 「先頭2つの ':' だけ」で type/mode/item_key に割ること。対戦印を 'v:w' のように付けると
// type='v' / mode='w' / item_key='cloze:apple' と誤分解されるので、接頭辞は ':' を含まない
// 1トークンでなければならない。この不変条件を itemId と組み合わせて検証する。
import { describe, it, expect } from 'vitest'
import { itemId, statPrefix } from './recordKeys.service.js'

// itemStats.repository.js の splitId と同じ分解（テスト専用の写し）。
// 本体を import できない（未 export）ため、DB 側が id をどう読むかを再現して不変条件を確かめる。
function splitId(id) {
  const c1 = id.indexOf(':')
  const c2 = id.indexOf(':', c1 + 1)
  return { type: id.slice(0, c1), mode: id.slice(c1 + 1, c2), item_key: id.slice(c2 + 1) }
}

// 既存の種別接頭辞（records.service.js の itemStatId / storyStatId が使う値）。
const BASES = ['w', 'd', 's', 'story']

describe('statPrefix（#450 対戦用の item-stats 接頭辞）', () => {
  it('versus 省略・undefined・false はいずれも base をそのまま返す（通常プレイの id を1バイトも変えない）', () => {
    for (const base of BASES) {
      expect(statPrefix(base)).toBe(base)
      expect(statPrefix(base, undefined)).toBe(base)
      expect(statPrefix(base, false)).toBe(base)
    }
  })

  it('通常プレイの id は既存と完全に同一のまま（既存データとの互換）', () => {
    // 過去に積んだ統計を迷子にしないため、versus 無しの経路は従来の文字列と一致すること。
    expect(itemId(statPrefix('w'), 'en', 'reserve')).toBe('w:en:reserve')
    expect(itemId(statPrefix('d', false), 'ja', 'hotel')).toBe('d:ja:hotel')
    expect(itemId(statPrefix('s'), 'both', 'I go to school.')).toBe('s:both:I go to school.')
    expect(itemId(statPrefix('story'), 'en', 'climbing/n1')).toBe('story:en:climbing/n1')
  })

  it('versus が真なら base とは別の接頭辞を返す', () => {
    for (const base of BASES) {
      expect(statPrefix(base, true)).not.toBe(base)
    }
  })

  it('対戦用の接頭辞は 3種目とも vw / vd / vs（通常の接頭辞に v を冠する）', () => {
    expect(statPrefix('w', true)).toBe('vw')
    expect(statPrefix('d', true)).toBe('vd')
    expect(statPrefix('s', true)).toBe('vs')
  })

  it('対戦用の接頭辞は ":" を含まない（splitId が先頭2つの ":" で割るため）', () => {
    for (const base of BASES) {
      expect(statPrefix(base, true)).not.toContain(':')
    }
  })

  it('対戦用の接頭辞どうしが衝突しない（3種目が別の値になる）', () => {
    const versus = ['w', 'd', 's'].map((b) => statPrefix(b, true))
    expect(new Set(versus).size).toBe(versus.length)
  })

  it('対戦用の接頭辞は既存の接頭辞（w/d/s/story）のどれとも衝突しない', () => {
    for (const base of BASES) {
      expect(BASES).not.toContain(statPrefix(base, true))
    }
  })

  it('対戦 id を splitId で分解すると type だけが対戦印になり mode と item_key は通常時と一致する', () => {
    // 今回の設計の肝。type 列が分かれるだけで、mode と item_key は通常プレイと同じ座標に揃う。
    const normal = splitId(itemId(statPrefix('w'), 'cloze', 'apple'))
    const versus = splitId(itemId(statPrefix('w', true), 'cloze', 'apple'))
    expect(versus.type).not.toBe(normal.type)
    expect(versus.type).toBe(statPrefix('w', true))
    expect(versus.mode).toBe(normal.mode)
    expect(versus.item_key).toBe(normal.item_key)
  })

  it('item_key に ":" を含む問題（文中コロン）でも対戦 id の分解結果が通常時と一致する', () => {
    const key = 'I go to school: today.'
    const normal = splitId(itemId(statPrefix('s'), 'both', key))
    const versus = splitId(itemId(statPrefix('s', true), 'both', key))
    expect(normal.item_key).toBe(key)
    expect(versus.item_key).toBe(key)
    expect(versus.mode).toBe(normal.mode)
  })

  it('全域：想定外の入力でも throw しない（純粋・防御的）', () => {
    expect(() => statPrefix(undefined, true)).not.toThrow()
    expect(() => statPrefix(null, true)).not.toThrow()
    expect(() => statPrefix('', true)).not.toThrow()
    expect(() => statPrefix(1, true)).not.toThrow()
    expect(() => statPrefix('w', 'yes')).not.toThrow()
    expect(() => statPrefix()).not.toThrow()
  })

  it('決定性：同じ引数で何度呼んでも同じ値を返す', () => {
    expect(statPrefix('w', true)).toBe(statPrefix('w', true))
    expect(statPrefix('d')).toBe(statPrefix('d'))
  })
})
