// Specification パターン：「この候補は条件を満たすか」という判定をオブジェクト化し、
// and/or/not で合成する。分岐式（if の羅列）をドメインに閉じ込め、条件を
// 組み合わせ可能・再利用可能な部品として扱えるようにする。

// 述語 predicate を Specification へ包む。合成メソッドはいずれも新しい
// Specification を返し、元の spec を破壊しない（自身の isSatisfiedBy を
// クロージャで参照するだけ）。合成結果も and/or/not/isSatisfiedBy を持つ（閉じている）。
export function makeSpec(predicate) {
  const spec = {
    isSatisfiedBy(candidate) {
      return !!predicate(candidate)
    },
    and(other) {
      return makeSpec(
        (c) => spec.isSatisfiedBy(c) && other.isSatisfiedBy(c),
      )
    },
    or(other) {
      return makeSpec(
        (c) => spec.isSatisfiedBy(c) || other.isSatisfiedBy(c),
      )
    },
    not() {
      return makeSpec((c) => !spec.isSatisfiedBy(c))
    },
  }
  return spec
}
