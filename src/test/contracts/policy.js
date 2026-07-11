import { it, expect } from 'vitest'
import { assertDomainService } from './domainService.js'

// Policy（application の .policy.js の純関数）の契約テスト用の再利用ヘルパ。#332（#322 契約テストシリーズ）。
// Policy は「アプリ層の判断ロジック」＝状態を持たず、DOM/infra/React/クロック/乱数/ストレージに触れない
// 純関数の集まり（入力の値だけで決まり、副作用を持たない）。判断だけをここに閉じ、配線（IO）は別モジュールが担う。
//
// 核となる per-fn の3メタ性質（決定性・非破壊・外部乱数非依存）は DomainService と全く同じなので、
// #330 の assertDomainService をそのまま流用する（再実装＝二重実装を避ける）。Policy 固有の追加契約は
// 「環境非依存」＝ DOM/クロック/乱数/ストレージのグローバル識別子をソース中で一切参照しないこと。これは
// 個々の fn 実行では踏めない分岐（未到達枝でのグローバル参照）も含めて禁じたいため、実行時 spy ではなく
// ファイル単位の「静的 grep」で担保する（モジュールのソース文字列を1回走査する）。
//
// grep は誤検知を避けるためコメント除去（stripComments）を必須とする。理由：allRecords.policy.js と
// memoryStore.policy.js は説明コメント中に `localStorage` の語を含む（コードは純粋）ため、除去しないと
// コメント内トークンを拾って偽陽性で赤になる。Date は丸ごと禁止しない（`Date.parse(入力)` や
// `date.getTime()` は入力依存の純パースなので許容）。禁止するのは `Date.now` と引数なし `new Date()` のみ。
//
// #323 VO・#324 Entity・#325 Aggregate・#329 Repository・#330 DomainService 契約と同じ流儀。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。

// (A) per-fn 契約：決定性・非破壊・Math.random 非依存を assertDomainService に委譲する。
//   fn                … (...args) => output   対象の純関数。
//   sampleInput       … () => args[]          妥当な引数「配列」を毎回新しく返す（参照非共有）。
//   snapshot          … (args) => 観測状態    非破壊の観測像（既定：深クローン）。
//   checkNoMathRandom … Math.random を掴まないことを実行時にも検証するか（既定 true）。
export function assertPolicy({ fn, sampleInput, snapshot, checkNoMathRandom = true }) {
  assertDomainService({ fn, sampleInput, snapshot, checkNoMathRandom })
}

// 静的 grep で禁じる環境グローバル（Policy は入力の値だけで決まる＝いずれも参照してはならない）。
//   Date は全面禁止しない：Date.now と引数なし new Date() のみ禁止（入力の Date.parse/getTime は純パースで許容）。
const DEFAULT_FORBIDDEN = [
  /\bdocument\b/,
  /\bwindow\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bnavigator\b/,
  /\bMath\.random\b/,
  /\bperformance\b/,
  /\bDate\.now\b/,
  /\bindexedDB\b/,
  /new Date\s*\(\s*\)/,
]

// 行コメント（//…）とブロックコメント（/*…*/）を除去する。grep 前に必ず通す（コメント内トークンの誤検知回避）。
// http:// のような「: の直後の //」は URL とみなしてコメント扱いしない（行内コメントは直前が非 : のときのみ）。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // ブロックコメント
    .replace(/([^:]|^)\/\/.*$/gm, '$1') // 行コメント（行頭 or 直前が非 : のときだけ）
}

// (B) ファイル単位の静的 env 非依存契約。source＝当該 .policy.js のソース文字列を1回走査する。
export function assertPolicyEnvIndependent({ source, forbidden = DEFAULT_FORBIDDEN }) {
  it('環境非依存：DOM/クロック/乱数/ストレージのグローバルを参照しない（静的）', () => {
    const code = stripComments(source)
    const hits = forbidden.filter((re) => re.test(code)).map(String)
    expect(hits).toEqual([])
  })
}
