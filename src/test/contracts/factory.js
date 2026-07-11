import { it, expect } from 'vitest'

// Factory（.factory.js）の契約テスト用の再利用ヘルパ。#326。
// Factory は「生成手順（採番＋VO の合成）」の集約＝Entity の同一性(ID)を、外部注入された
// ID 生成器（nextId）から供給する。純ドメインは ID を作れない（Date/乱数/counter 非依存）ため、
// 決定性は注入器で担保する（テストは決定的な生成器を渡す）。#324 の Entity 契約と対になる。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Factory に依存しない純関数で渡す）：
//   createFactory … (nextId) => factory   注入器 nextId（()=>string）を受け取り Factory を返す。
//   start         … (factory, ec) => entity  Factory で Entity を生成する。
//   equals        … (a, b) => boolean     生成された Entity の同一性(id)等価（id 一致で true・null 安全）。
//   sampleEC      … () => endCondition     妥当な endCondition を毎回新しく返す（参照非共有）。
//   invalidEC     … [ec, ...]             start が throw すべき不正 endCondition の一覧（省略時は空）。
export function assertFactory({ createFactory, start, equals, sampleEC, invalidEC = [] }) {
  // 決定的な採番注入器（対象非依存＝連番で毎回異なる id を返す）。
  const makeCounter = () => {
    let n = 0
    return () => 'ts-' + ++n
  }

  it('採番注入：同じ Factory から連続生成すると id が変わり別 Entity になる', () => {
    const f = createFactory(makeCounter())
    const a = start(f, sampleEC())
    const b = start(f, sampleEC())
    expect(equals(a, b)).toBe(false) // 連番で id が変わる＝別 Entity
  })

  it('妥当な Entity を返す：生成物は非 null で自己等価', () => {
    const a = start(createFactory(makeCounter()), sampleEC())
    expect(a).not.toBeNull()
    expect(equals(a, a)).toBe(true) // 妥当な同一性を持つ
  })

  it('決定性：同じ注入器から作った2つの Factory は同一性が一致する', () => {
    const a1 = start(createFactory(makeCounter()), sampleEC())
    const a2 = start(createFactory(makeCounter()), sampleEC())
    expect(equals(a1, a2)).toBe(true) // 同一の counter＝先頭 id が一致
  })

  it('自己検証：不正な endCondition は start が throw', () => {
    for (const bad of invalidEC) {
      expect(() => start(createFactory(makeCounter()), bad)).toThrow()
    }
  })

  it('自己検証：不正な注入器（非関数）は createFactory が throw', () => {
    for (const bad of [undefined, null, 123, 'x', {}]) {
      expect(() => createFactory(bad)).toThrow()
    }
  })
}
