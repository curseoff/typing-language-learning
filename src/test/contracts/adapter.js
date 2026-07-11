import { it, expect } from 'vitest'

// Adapter（infrastructure の .adapter.js）の契約テスト用の再利用ヘルパ。#334（#322 契約テストシリーズ）。
// Adapter は「内側 Port（application/domain が要求するインターフェース）を外部技術（ブラウザ API・
// Worker・OPFS・FSA・AudioContext 等）で実装する ACL（腐敗防止層）」。外の都合を内へ漏らさず、
// 外が不在/失敗しても内側は安全な既定値で縮退できるようにする境界＝ここが「壊れない」ことを守る。
//
// Adapter の実挙動（OPFS 読み書き・SW 更新・2タブ handoff・Worker protocol）は環境（実ブラウザ）が
// 要る＝pwa-verifier の領分であり、ここでは扱わない。契約テストは「静的/結合」に限定する：
//   (A) Port 形状の適合    … 宣言した Port メソッドをすべて function として公開しているか。
//   (D) 失敗の契約（縮退）  … browser 不在（＝bare node で外部技術が無い失敗経路そのもの）で throw せず、
//                            安全な既定値へ縮退するか（同期 return / async resolve のいずれも reject/throw しない）。
// import 純度（top-level 副作用でロードが失敗しないこと）は、この contract.test を node 既定環境で
// import できる事実そのもので担保する（top-level 副作用があれば test ロード時点で赤になる）。
//
// returns/resolves に `expect.any(Function)` を渡せば「unsubscribe（購読解除）関数を返す」契約も
// そのまま表現できる（subscribe 系 Port は縮退時も no-op の解除関数を返すのが安全側）。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数：
//   module   … 名前空間 import した adapter モジュール（`import * as m from './x.adapter.js'`）。
//   port     … string[]  この adapter が公開すべき Port メソッド名の一覧。
//   failsSafe … 失敗の契約を検証したい Port ごとの指定（省略可）。各要素：
//     name     … it 名に載せる Port メソッド名。
//     call     … (module) => out   縮退経路を踏む呼び出し（browser 不在の bare node で実行される）。
//     resolves … 省略可。async Port の解決値（`await …).resolves.toEqual(resolves)`。asymmetric matcher 可）。
//     returns  … 省略可。sync Port の戻り値（`expect(out).toEqual(returns)`。asymmetric matcher 可）。
//       ※ resolves と returns の両方を省くと「同期 throw しない」ことだけを契約する（no-op 系）。
export function assertAdapter({ module, port, failsSafe = [] }) {
  it('Port 形状: 宣言したメソッドをすべて関数として公開する', () => {
    for (const name of port) {
      expect(typeof module[name], `${name} は function であるべき`).toBe('function')
    }
  })

  for (const { name, call, resolves, returns } of failsSafe) {
    it(`失敗の契約（browser 不在）: ${name} は throw せず既定値へ縮退する`, async () => {
      let out
      // 同期 throw しない（外部技術の不在をここで飲み込むのが ACL の役目）。
      expect(() => {
        out = call(module)
      }).not.toThrow()
      if (resolves !== undefined) {
        // async：reject せず既定値へ解決する。
        await expect(Promise.resolve(out)).resolves.toEqual(resolves)
      } else if (returns !== undefined) {
        // sync：安全な既定値を返す。
        expect(out).toEqual(returns)
      }
    })
  }
}
