// #450 対戦の学習統計を通常プレイと区別する（Red）。
// 「分けて持ち、合算で見せる」の合算側。収録一覧（ItemList.container）が通常 id と対戦 id の
// 2つを引いて足すための純関数 sumItemStats(...stats) の仕様。
//
// 最重要は「全部 undefined なら undefined を返す」こと。現在の ItemList は記録の無い問題に
// undefined を渡して「何も表示しない」挙動なので、{count:0,...} を返すと未挑戦の問題に 0 が
// ずらりと並ぶ表示の回帰になる。
import { describe, it, expect } from 'vitest'
import { sumItemStats } from './itemStatMerge.policy.js'

const stat = (count, keys, mistakes, ms) => ({ count, keys, mistakes, ms })

describe('sumItemStats（#450 通常＋対戦の合算）', () => {
  it('全部 undefined なら undefined を返す（記録なしは「何も表示しない」を保つ）', () => {
    expect(sumItemStats(undefined, undefined)).toBeUndefined()
    expect(sumItemStats(undefined)).toBeUndefined()
    expect(sumItemStats(undefined, undefined, undefined)).toBeUndefined()
  })

  it('引数が1つも無ければ undefined を返す', () => {
    expect(sumItemStats()).toBeUndefined()
  })

  it('片方だけ実体があればその値と同値を返す（もう片方は 0 として足す）', () => {
    expect(sumItemStats(stat(2, 20, 1, 3000), undefined)).toEqual(stat(2, 20, 1, 3000))
    expect(sumItemStats(undefined, stat(5, 50, 4, 9000))).toEqual(stat(5, 50, 4, 9000))
  })

  it('両方に実体があれば count/keys/mistakes/ms をそれぞれ足す', () => {
    expect(sumItemStats(stat(2, 20, 1, 3000), stat(3, 33, 2, 4000))).toEqual(stat(5, 53, 3, 7000))
  })

  it('引数は可変個で、3つ以上でも全部足す（将来 3系統に増えても困らない）', () => {
    expect(sumItemStats(stat(1, 10, 0, 100), stat(2, 20, 1, 200), stat(4, 40, 3, 400))).toEqual(
      stat(7, 70, 4, 700),
    )
  })

  it('欠けている項目は 0 として足す（片方に ms が無い等）', () => {
    expect(sumItemStats({ count: 1, keys: 10 }, { count: 2, mistakes: 3, ms: 500 })).toEqual(
      stat(3, 10, 3, 500),
    )
  })

  it('項目が全部欠けた空オブジェクトでも実体として扱い、0 埋めの合算を返す', () => {
    // 「実体があるか」は undefined かどうかで決まる（空オブジェクトは記録あり扱い）。
    expect(sumItemStats({}, undefined)).toEqual(stat(0, 0, 0, 0))
  })

  it('返り値は新しいオブジェクトで、引数を書き換えない（非破壊）', () => {
    const a = stat(2, 20, 1, 3000)
    const b = stat(3, 33, 2, 4000)
    const out = sumItemStats(a, b)
    expect(out).not.toBe(a)
    expect(out).not.toBe(b)
    expect(a).toEqual(stat(2, 20, 1, 3000))
    expect(b).toEqual(stat(3, 33, 2, 4000))
  })

  it('返り値は count/keys/mistakes/ms の4項目だけを持つ', () => {
    const out = sumItemStats({ count: 1, keys: 10, mistakes: 0, ms: 100, id: 'w:en:apple' }, undefined)
    expect(Object.keys(out).sort()).toEqual(['count', 'keys', 'mistakes', 'ms'])
  })

  it('全域：null や数値・文字列を渡しても throw せず、記録なしとして扱う', () => {
    expect(() => sumItemStats(null, 1, 'x')).not.toThrow()
    expect(sumItemStats(null, undefined)).toBeUndefined()
    expect(sumItemStats(1, 'x')).toBeUndefined()
    // 実体と混ざっても壊さない（実体だけが足される）。
    expect(sumItemStats(null, stat(2, 20, 1, 3000), 'x')).toEqual(stat(2, 20, 1, 3000))
  })

  it('決定性：同じ入力で2回呼ぶと同じ結果を返す', () => {
    const args = [stat(1, 10, 0, 100), undefined, stat(2, 20, 1, 200)]
    expect(sumItemStats(...args)).toEqual(sumItemStats(...args))
  })
})
