import { it, expect } from 'vitest'

// Aggregate Root（集約ルート・.aggregate.js）の契約テスト用の再利用ヘルパ。#325。
// Aggregate は Entity の同一性(key/id)等価に「集合全体の不変条件を根が常に保証」を足したもの。
// ＝変更経路をルート(submit)に限定し、外部へは凍結スナップショットしか渡さず（カプセル化）、
// 上限などの不変条件をどの操作後も保つ。#324 の Entity 契約・#323 の VO 契約と対になる。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Aggregate に依存しない純関数で渡す）：
//   make        … (args) => root      集約ルートを生成するファクトリ（自己検証つき）。
//   equals      … (a, b) => boolean   同一性(key/id)等価（throw しない・null 安全・状態が変わっても同一）。
//   submit      … (root, record) => root  ルート経由の唯一の変更経路。元を変えず新しいルートを返す。
//   entries     … (root) => Array     内部集合の凍結スナップショット。
//   sample      … () => args          満杯（size === MAX）の集約を作る make 引数を毎回新しく返す（参照非共有）。
//   worseRecord … record              満杯集約の全既存より悪い（満杯時に採用されない）record。
export function assertAggregate({ make, equals, submit, entries, sample, worseRecord }) {
  it('同一性等価（Entity）：状態が変わっても同 key なら同一の集約', () => {
    const root = make(sample())
    expect(equals(root, submit(root, worseRecord))).toBe(true)
  })

  it('外部へは凍結スナップショットを渡す（Object.isFrozen true）', () => {
    expect(Object.isFrozen(entries(make(sample())))).toBe(true)
  })

  it('スナップショットを破壊操作しても内部集合には波及しない（カプセル化）', () => {
    const root = make(sample())
    const snapshot = entries(root)
    const expected = [...snapshot] // 破壊操作前の内容を控える
    try {
      snapshot.push({}) // 凍結配列への破壊操作は throw しうる＝それでも内部は不変であることを以下で確認。
      snapshot[0] = {}
    } catch {
      // no-op
    }
    const after = entries(root)
    expect(after.length).toBe(expected.length) // 件数は不変
    expect(after).toEqual(expected) // 内容も不変
  })

  it('変更経路はルート(submit)に限定・イミュータブル：元のルートは変わらない', () => {
    const root = make(sample())
    const before = entries(root)
    const next = submit(root, worseRecord)
    expect(next).not.toBe(root) // 新しいルート
    expect(entries(root)).toEqual(before) // 元は不変
  })

  it('上限の不変条件を根が保証：満杯へ submit しても件数は増えない（MAX を超えない）', () => {
    const root = make(sample())
    const fullLen = entries(root).length
    const next = submit(root, worseRecord)
    expect(entries(next).length).toBeLessThanOrEqual(fullLen)
  })

  it('押し出し規則：満杯で全既存より悪い record は採用されない（entries に含まれない）', () => {
    const root = make(sample())
    const next = submit(root, worseRecord)
    expect(entries(next)).not.toContainEqual(worseRecord)
  })

  it('null/不正は false（throw しない）', () => {
    expect(equals(make(sample()), null)).toBe(false)
    expect(equals(null, make(sample()))).toBe(false)
  })
}
