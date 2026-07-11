import { it, expect } from 'vitest'

// Entity（.entity.js）の契約テスト用の再利用ヘルパ。#324。
// Entity の核心＝同一性(id)等価を検証する（VO の値等価とは相互排他＝VO では必ず落ちる assert を含む）。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Entity に依存しない純関数で渡す）：
//   make    … (args) => Entity      ファクトリ（自己検証つき）。
//   equals  … (a, b) => boolean     同一性等価（id 一致で true・throw しない・null 安全）。
//   withId  … (id, opts?) => args   指定 id の生成引数。opts.differ=true で「同 id・他フィールドは別」の引数を返す。
//   evolve  … (entity) => entity    状態遷移後の実体（可変メソッド or イミュータブル with*/recordAttempt。id 不変）。
//   invalid … [args, ...]           make が throw すべき不正引数（id 欠落/空・不変条件違反など）。
export function assertEntity({ make, equals, withId, evolve, invalid = [] }) {
  it('同一性等価：同 id なら他フィールドが違っても等しい', () => {
    expect(equals(make(withId('X')), make(withId('X', { differ: true })))).toBe(true)
  })

  it('別 id は（値が同じでも）等しくない', () => {
    expect(equals(make(withId('X')), make(withId('Y')))).toBe(false)
  })

  it('状態遷移しても同一性は保たれる', () => {
    const a = make(withId('X'))
    expect(equals(a, evolve(a))).toBe(true)
  })

  it('null/不正は false（throw しない）', () => {
    expect(equals(make(withId('X')), null)).toBe(false)
    expect(equals(null, make(withId('X')))).toBe(false)
  })

  it('自己検証：不正入力（id 欠落/空 等）は make が throw', () => {
    for (const bad of invalid) expect(() => make(bad)).toThrow()
  })
}
