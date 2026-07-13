import { it, expect } from 'vitest'

// Value Object（.vo.js）の契約テスト用の再利用ヘルパ。#323 / #383。
// VO 契約は2層：
//   ・普遍層（常時登録・全 VO 共通）… 不変・自己検証・非identity deep-equal。
//   ・任意層（equals を渡した時だけ登録）… 値等価・非等価・null 安全。
// 値等価（*Equals）を持つ VO は両層、持たない VO（equals 省略）は普遍層のみで検証する。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の VO に依存しない純関数で渡す）：
//   make    … (args) => VO         ファクトリ（凍結オブジェクトを返す）。
//   sample  … () => args           妥当な生成引数を毎回新しく返す（参照非共有）。
//   invalid … [args, ...]          make が throw すべき不正引数の一覧（省略時は空＝自己検証を検証しない）。
//   equals  … (a, b) => boolean    値等価（throw しない・null 安全）。任意＝省略時は任意層 it を登録しない。
//   mutate  … (args) => args       sample の1フィールドだけ変えた引数（非等価の検証用）。任意＝
//                                   equals を渡した時のみ使う（省略時は非等価 it を登録しない）。
export function assertValueObject({ make, equals, sample, mutate, invalid = [] }) {
  // ── 普遍層（全 VO 共通・常時登録）───────────────────────────────
  it('不変：make の返り値は Object.freeze 済み', () => {
    expect(Object.isFrozen(make(sample()))).toBe(true)
  })

  it('非identity：別インスタンスは別参照だが構造 deep-equal（値で決まる）', () => {
    const a = make(sample())
    const b = make(sample())
    expect(a).not.toBe(b) // 別参照
    // VO の同一性は「値（データ項目）」で決まる＝メソッド（振る舞い）は同一性に含めない。
    // Progress のようにイミュータブル変換メソッド（withHit 等）をインスタンスに持つ VO は、
    // 別インスタンスのメソッドが別クロージャ参照になり生の toEqual では不等になる。
    // よってデータ射影（関数プロパティを除いた構造）を toEqual で比較する（equals には依存しない
    // ＝*Equals を持たない ScoreRecord も構造 deep-equal で「値で等しい」を担保できる）。
    expect(dataOnly(a)).toEqual(dataOnly(b)) // 構造 deep-equal（値で等しい）
  })

  it('自己検証：不正入力は make が throw', () => {
    for (const bad of invalid) expect(() => make(bad)).toThrow()
  })

  // ── 任意層（equals を渡した VO のみ登録）──────────────────────────
  if (equals) {
    it('値等価：別インスタンスでも同値なら等しい', () => {
      const a = make(sample())
      const b = make(sample())
      expect(a).not.toBe(b) // 別参照
      expect(equals(a, b)).toBe(true) // 値で等価
    })

    if (mutate) {
      it('値が違えば等しくない', () => {
        expect(equals(make(sample()), make(mutate(sample())))).toBe(false)
      })
    }

    it('null/不正は false（throw しない）', () => {
      expect(equals(make(sample()), null)).toBe(false)
      expect(equals(null, make(sample()))).toBe(false)
    })
  }
}

// 値（データ項目）だけを残した射影を再帰的に作る（関数＝振る舞いは除外）。
// 非identity 法則で「別インスタンスが値で等しい」を構造 deep-equal で確かめるために使う。
// プレーンオブジェクト／配列を辿り、関数プロパティは落とす（プリミティブ・null はそのまま）。
function dataOnly(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(dataOnly)
  const out = {}
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'function') continue
    out[key] = dataOnly(value[key])
  }
  return out
}
