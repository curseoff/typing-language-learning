import { it, expect } from 'vitest'

// Specification（.specification.js）の契約テスト用の再利用ヘルパ。#328。
// Specification は「候補が条件を満たすか」という判定を述語オブジェクト化し、
// and/or/not で合成する（合成結果も同じインターフェースを持つ＝閉じている／
// 元 spec を破壊しない）。ここでは真理値表・閉包・非破壊の「外形」だけを検証し、
// makeSpec の内部実装は写経しない（独立性）。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（対象非依存＝TRUE/FALSE spec はヘルパが自前で合成する）：
//   makeSpec … (predicate) => spec   述語 (candidate)=>boolean を Specification へ包む生成関数。
export function assertSpecification({ makeSpec }) {
  // 定数述語の spec（真理値表の入力に使う）。呼ぶたび新しい spec を返す（非破壊検証のため参照非共有）。
  const TRUE = () => makeSpec(() => true)
  const FALSE = () => makeSpec(() => false)
  // candidate は任意（述語が定数なので中身不問）。
  const holds = (s) => s.isSatisfiedBy({})
  // spec の外形＝合成メソッドと判定メソッドを備えているか。
  const isSpec = (s) =>
    s && ['isSatisfiedBy', 'and', 'or', 'not'].every((m) => typeof s[m] === 'function')

  it('述語オブジェクト：isSatisfiedBy は truthy/falsy を厳密 boolean に矯正して返す', () => {
    expect(typeof holds(TRUE())).toBe('boolean')
    expect(holds(makeSpec(() => 1))).toBe(true) // truthy → true
    expect(holds(makeSpec(() => 0))).toBe(false) // falsy → false
  })

  it('合成で閉じている：and/or/not は再び spec を返す', () => {
    const s = TRUE()
    const t = FALSE()
    expect(isSpec(s.and(t))).toBe(true)
    expect(isSpec(s.or(t))).toBe(true)
    expect(isSpec(s.not())).toBe(true)
  })

  it('真理値表 and：両方 true のときだけ true', () => {
    expect(holds(TRUE().and(TRUE()))).toBe(true)
    expect(holds(TRUE().and(FALSE()))).toBe(false)
    expect(holds(FALSE().and(TRUE()))).toBe(false)
    expect(holds(FALSE().and(FALSE()))).toBe(false)
  })

  it('真理値表 or：どちらかが true なら true', () => {
    expect(holds(TRUE().or(TRUE()))).toBe(true)
    expect(holds(TRUE().or(FALSE()))).toBe(true)
    expect(holds(FALSE().or(TRUE()))).toBe(true)
    expect(holds(FALSE().or(FALSE()))).toBe(false)
  })

  it('真理値表 not：真偽を反転する', () => {
    expect(holds(TRUE().not())).toBe(false)
    expect(holds(FALSE().not())).toBe(true)
  })

  it('二重否定 not(not(s)) は s と同じ真理値になる', () => {
    expect(holds(TRUE().not().not())).toBe(true)
    expect(holds(FALSE().not().not())).toBe(false)
  })

  it('非破壊：合成しても元 spec の真理値は変わらない', () => {
    const s = TRUE()
    const before = holds(s)
    s.and(FALSE())
    s.or(FALSE())
    s.not()
    expect(holds(s)).toBe(before)
  })
}
