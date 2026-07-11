import { it, expect, vi } from 'vitest'

// Domain Service（domain の .service.js）の契約テスト用の再利用ヘルパ。#330。
// DomainService は「どの Entity/VO にも自然に属さない横断ロジック」＝状態を持たない純関数の集まり。
// その核＝3つのメタ性質を、各 fn の具体計算を再エンコードせずに（＝同義反復を避けて）検証する：
//   1. 決定性     … 同じ入力からは常に同じ出力（乱数を使う fn は外部から rng を注入して固定する）。
//   2. 非破壊     … 引数（入力）を書き換えない（読み取りのみ。副作用を持たない）。
//   3. 外部乱数非依存 … Math.random 等のグローバル乱数を掴まない（決定性の源を引数だけに閉じる）。
// 各 fn の「何を計算するか」は当該 service の *.test.js が担う（ここでは正解値をベタ書きしない）。
// #323 の VO 契約・#324 の Entity 契約・#325 の Aggregate 契約・#329 の Repository 契約と同じ流儀。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の service に依存しない純関数で渡す・独立オラクル）：
//   fn         … (...args) => output   対象の純関数。
//   sampleInput… () => args[]          妥当な引数「配列」を毎回新しく返す（参照非共有）。
//                ★rng を使う fn は sampleInput の中で mulberry32(seed) を新規生成して {rng} に注入する
//                （毎回別インスタンス＝同一 seed から同一乱数列＝決定性の要）。describe スコープで
//                作った rng を使い回すと状態が進み決定性が偽陰性で落ちるので厳禁。
//   snapshot   … (args) => 観測状態    非破壊の観測像（既定：関数/undefined を落とした深クローン）。
//                Entity のクロージャ状態など JSON では見えない入力は専用 snapshot を渡す。
//   checkNoMathRandom … Math.random を掴まないことを検証するか（既定 true）。
export function assertDomainService({
  fn,
  sampleInput,
  snapshot = (args) => JSON.parse(JSON.stringify(args)),
  checkNoMathRandom = true,
}) {
  it('決定性：同じ入力（新しい rng でも同一 seed）から同じ出力を返す', () => {
    // 毎回 sampleInput() で新しい引数（＝新シードの rng）を作り、2回の出力が深く等しいことを見る。
    expect(fn(...sampleInput())).toEqual(fn(...sampleInput()))
  })

  it('非破壊：呼び出し後も引数の観測状態が変わらない（読み取りのみ）', () => {
    const args = sampleInput()
    const before = snapshot(args)
    fn(...args)
    expect(snapshot(args)).toEqual(before)
  })

  if (checkNoMathRandom) {
    it('外部乱数非依存：Math.random を掴まない（決定性の源は引数に閉じる）', () => {
      const spy = vi.spyOn(Math, 'random')
      let calls
      try {
        fn(...sampleInput())
        // mockRestore は呼び出し履歴もリセットするため、復元前に回数を捕捉して判定する。
        calls = spy.mock.calls.length
      } finally {
        spy.mockRestore()
      }
      expect(calls).toBe(0)
    })
  }
}
