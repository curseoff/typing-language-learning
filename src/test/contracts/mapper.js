import { it, expect } from 'vitest'

// Mapper（.mapper.js）の契約テスト用の再利用ヘルパ。#337。
// Mapper は「列⇄record の純双方向コーデック」＝DB/IO 非依存の純関数ペアで、往復不変（round-trip）・
// 決定的（同入力→同出力）・非破壊（入力を変えない）を満たす。変換の中身（列名・JSON 文字列表現）は
// 実装詳細として写経せず、外形の3法則だけを見る（対象非依存）。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Mapper に依存しない純関数で渡す）：
//   toColumns … (value) => columns  record→列 の変換。
//   fromRow   … (columns) => value  列→record の変換（toColumns の逆）。
//   sample    … () => value         妥当な値を毎回新しく返す（参照非共有）。
export function assertMapper({ toColumns, fromRow, sample }) {
  it('往復不変：fromRow(toColumns(sample)) は元の値に等しい', () => {
    expect(fromRow(toColumns(sample()))).toEqual(sample())
  })

  it('決定的：同値入力に対し toColumns/fromRow とも同じ出力を返す', () => {
    expect(toColumns(sample())).toEqual(toColumns(sample()))
    const cols = toColumns(sample())
    expect(fromRow(cols)).toEqual(fromRow(cols))
  })

  it('非破壊：toColumns は入力オブジェクトを変更しない', () => {
    const v = sample()
    const before = JSON.parse(JSON.stringify(v)) // 深クローン（JSON 往復）
    toColumns(v)
    expect(v).toEqual(before)
  })
}
