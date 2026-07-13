import { it, expect } from 'vitest'

// Container（ui の .container.jsx）の契約テスト用の再利用ヘルパ。#338（#322 契約テストシリーズ）。
// Container は「配線（wiring）」＝フック／application／content／domain を束ねて presenter（表示）へ props を
// 渡す層。判断（判定）・整列（ソート）・採点（集約）といった業務ロジック/計算は domain/application が持ち、
// container はそれらを『呼ぶ・注入する』だけで自前実装しない＝ここが「責務を漏らさない」ことを守る。
//
// 契約テストは「静的」に限定する（assertPolicyEnvIndependent の source grep 型に倣う）。理由：
//   - container の実挙動（フックの状態遷移・イベント配線・presenter への受け渡し）は Provider/DOM/lazy content
//     を要する結合であり、対象 26 ファイルは粒度がまちまち（純ラッパ〜表示 JSX 内包）。render 結合は fragile で
//     over-fit になりやすいため、ここでは踏み込まず、当該 container の *.test.* や結合テストに委ねる。
//   - 代わりに「責務が漏れていない」＝業務ロジックの痕跡が container ソースに無いことを1回の grep で担保する。
//
// 何を「業務ロジック/計算の漏出」とみなすか（判定/整列/採点の委譲違反）：
//   - 整列   … Array.prototype.sort / String.prototype.localeCompare を container 内で直接行う
//              （並べ替えは application/domain のサービスへ委譲し、必要なら sortFn を注入する）。
//   - 集約/採点 … Array.prototype.reduce で畳み込み集計・スコアリングする（集計は domain/application の役目）。
// これらは現状すべての container で不在（＝クリーン）。将来 container に整列/集約を書き込む退行を静的に禁じる。
//
// 対象外（あえて禁じない）：表示に密着した軽い算術（速度/正確率の Math.round・進捗の Math.min 等）は
// 既存兄弟の粒度に合わせ許容する（薄い契約に留め over-fit しない）。map/for による presenter 用の
// 「載せ替え（shape 変換）」も配線の範囲として許容する（集約ではなく1対1の受け渡し整形）。
//
// #323 VO・#324 Entity・#325 Aggregate・#329 Repository・#330 DomainService・#332 Policy 契約と同じ流儀。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。

// 静的 grep で禁じる「業務ロジック/計算」の痕跡（整列＝sort/localeCompare、集約/採点＝reduce）。
const DEFAULT_FORBIDDEN = [
  /\.sort\s*\(/, // 整列は application/domain へ（container は sortFn 注入や整列済み配列の受け渡しに留める）
  /\.localeCompare\b/, // 比較整列も同上
  /\.reduce\s*\(/, // 集約/採点（畳み込み）は domain/application の役目
]

// 行コメント（//…）とブロックコメント（/*…*/）を除去する。grep 前に必ず通す（コメント内トークンの誤検知回避）。
// http:// のような「: の直後の //」は URL とみなしてコメント扱いしない（行内コメントは直前が非 : のときのみ）。
// policy.js の stripComments と同趣旨（3 行の小ヘルパ＝各契約ファイルで自足させる）。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // ブロックコメント
    .replace(/([^:]|^)\/\/.*$/gm, '$1') // 行コメント（行頭 or 直前が非 : のときだけ）
}

// ファイル単位の静的な「責務漏れ非在」契約。source＝当該 .container.jsx のソース文字列を1回走査する。
//   source   … 対象 container のソース文字列。
//   name     … it 名に載せる識別子（相対パス等）。
//   forbidden … 禁止パターン配列（既定＝整列/集約）。
export function assertContainer({ source, name, forbidden = DEFAULT_FORBIDDEN }) {
  it(`${name}: 業務ロジック非漏出（整列/採点/集約 sort・localeCompare・reduce を持たず委譲する・静的）`, () => {
    const code = stripComments(source)
    const hits = forbidden.filter((re) => re.test(code)).map(String)
    expect(hits).toEqual([])
  })
}
