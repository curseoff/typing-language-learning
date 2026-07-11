import { it, expect } from 'vitest'

// Value Object（.vo.js）の契約テスト用の再利用ヘルパ。#323。
// 値等価を持つ VO が満たすべき4法則（不変・値等価・非等価・null安全）＋自己検証を it() で登録する。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の VO に依存しない純関数で渡す）：
//   make    … (args) => VO         ファクトリ（凍結オブジェクトを返す）。
//   equals  … (a, b) => boolean    値等価（throw しない・null 安全）。
//   sample  … () => args           妥当な生成引数を毎回新しく返す（参照非共有）。
//   mutate  … (args) => args       sample の1フィールドだけ変えた引数（非等価の検証用）。
//   invalid … [args, ...]          make が throw すべき不正引数の一覧（省略時は空＝自己検証を検証しない）。
export function assertValueObject({ make, equals, sample, mutate, invalid = [] }) {
  it('不変：make の返り値は Object.freeze 済み', () => {
    expect(Object.isFrozen(make(sample()))).toBe(true)
  })

  it('値等価：別インスタンスでも同値なら等しい', () => {
    const a = make(sample())
    const b = make(sample())
    expect(a).not.toBe(b) // 別参照
    expect(equals(a, b)).toBe(true) // 値で等価
  })

  it('値が違えば等しくない', () => {
    expect(equals(make(sample()), make(mutate(sample())))).toBe(false)
  })

  it('null/不正は false（throw しない）', () => {
    expect(equals(make(sample()), null)).toBe(false)
    expect(equals(null, make(sample()))).toBe(false)
  })

  it('自己検証：不正入力は make が throw', () => {
    for (const bad of invalid) expect(() => make(bad)).toThrow()
  })
}
