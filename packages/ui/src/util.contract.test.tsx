// packages/ui の Util（*.util.ts）を共通契約（assertUtil）に載せるメタテスト。#341。
// 対象は「純粋な UI 設定・計算」＝ touch/keyboardLayout.util.ts（定数データ）と
// shared/tickerMask.util.ts（純関数 computeTickerFade / tickerMaskImage）。
//
// Util 契約＝次の3メタ性質を、各 fn の具体計算を再エンコードせず（＝同義反復を避けて）検証する：
//   1. 決定性     … 同じ入力からは常に同じ出力（Util は乱数/クロックを持たないので入力だけで決まる）。
//   2. 非破壊     … 引数（入力）を書き換えない（読み取りのみ・副作用なし）。
//   3. 副作用importなし … source を「静的」に走査し、IO/DOM/クロック/乱数の参照が無い
//                     （Math.random / Date / performance / document / window / navigator /
//                      localStorage / fetch / XMLHttpRequest / crypto.getRandomValues /
//                      setTimeout / setInterval / require / node:* の import 等）。
// 各 fn の「何を計算するか」は当該 util の *.test.tsx が担う（ここでは正解値をベタ書きしない）。
// root の src/test/contracts/domainService.js（assertDomainService）と対になる packages/ui 版。
//
// ── coder が実装する契約ヘルパ（本テストは未実装のため赤＝Red）──
//   packages/ui/src/test/contracts/util.ts が assertUtil を default でなく named export する。
//   シグネチャ（外形は src/test/contracts/*.js に倣う。TS）：
//     assertUtil({ fn?, cases?, source, clone? }): void
//       fn     … 対象の純関数（省略時は runtime 検査（決定性・非破壊）を張らない＝定数モジュール用）。
//       cases  … () => unknown[][]  「引数タプル」の配列を毎回新しく返す（参照非共有＝非破壊検査の要）。
//                fn を渡すなら必須。各タプルは fn(...tuple) で呼べる形。
//       source … 対象 util モジュールの生ソース文字列（静的 purity 走査に使う・必須）。
//       clone  … (args) => 観測像（既定：関数/undefined を落とした JSON 深クローン）。
//   assertUtil は内部で it(...) を張る（describe(...) の中から呼ぶ想定・import 専用ヘルパ）。
//     - fn+cases があれば「決定性」「非破壊」の it。
//     - source から上記の禁止参照を1つでも見つけたら失敗する「副作用importなし」の it。
//       （Math.max/Math.min など乱数以外の Math 呼び出しは許容＝Math\.random 等の限定一致で判定する）
import { readFileSync } from 'node:fs'
import { describe } from 'vitest'
// ↓ 未実装（coder が packages/ui/src/test/contracts/util.ts を作る）＝この import 解決失敗で赤。
import { assertUtil } from './test/contracts/util'
import { computeTickerFade, tickerMaskImage } from './shared/tickerMask.util'

// 静的 purity 走査に渡す「生ソース」。node 環境（既定）でファイルをそのまま読む。
const tickerMaskSrc = readFileSync(
  new URL('./shared/tickerMask.util.ts', import.meta.url),
  'utf-8',
)
const keyboardLayoutSrc = readFileSync(
  new URL('./touch/keyboardLayout.util.ts', import.meta.url),
  'utf-8',
)

// computeTickerFade / tickerMaskImage の入力タプル（毎回新しい boxes/opts を返す＝参照非共有）。
//  - entering 語あり（右から入ってくる先読み語）／すべて収まる（先読み無し）／計測前(null)／trackWidth 0 の早期退避。
const tickerCases = (): unknown[][] => [
  [[{ left: 0, width: 60 }, { left: 120, width: 80 }], 150, { gap: 10, edge: 8, curIndex: 0 }],
  [[{ left: 0, width: 40 }, { left: 50, width: 40 }], 200, {}],
  [null, 150, {}],
  [[{ left: 0, width: 10 }], 0, {}],
]

describe('Util契約: shared/tickerMask.util（純関数）', () => {
  describe('computeTickerFade', () =>
    assertUtil({
      fn: computeTickerFade,
      cases: tickerCases,
      source: tickerMaskSrc,
    }))

  describe('tickerMaskImage', () =>
    assertUtil({
      fn: tickerMaskImage,
      cases: tickerCases,
      source: tickerMaskSrc,
    }))
})

describe('Util契約: touch/keyboardLayout.util（定数データ）', () =>
  // 関数を持たない純データモジュール＝runtime 検査は張らず「副作用importなし」の静的 purity のみ。
  assertUtil({ source: keyboardLayoutSrc }))
