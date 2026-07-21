// Vitest セットアップ（UIテスト用）。jest-dom のマッチャ（toBeInTheDocument 等）を有効化。
import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import { mulberry32 } from '../domain/rng.service.js'

// #468 テストの決定性：テスト実行中の Math.random をシード付き PRNG の列に差し替える。
// 素の Math.random だと makeSeed()（application/seed.policy.js）が毎回別の seed を返し、
// 出題順＝走る分岐が実行ごとに変わってカバレッジが揺れる（CI が確率的に閾値割れする）。
//   ・定数を返すのではなく「列」にするのが要。useWords の restart は seed を切り直して
//     別の問題列にする仕様で、その検証テストは2回の makeSeed() が異なる値を返すことに依る。
//   ・各テストの直前に同じ初期シードへ戻すので、ファイルの実行順や並列ワーカー数に依らず
//     どのテストも常に同じ乱数列を見る（＝実行間で完全に再現する）。
// 自前で Math.random を差し替えて復元するテスト（versusSegments.policy.test.js）や
// vi.spyOn(Math,'random') で呼び出しを検査する契約テストは、復元先がこの PRNG になるだけで無害。
// モジュール読み込み時（テストファイルのトップレベル＝収集時に乱数を使う fixture 生成）にも効くよう
// 即座に一度差し替えたうえで、テストごとに同じ初期シードへ戻す。
const TEST_RANDOM_SEED = 0x5eed1234
Math.random = mulberry32(TEST_RANDOM_SEED)
beforeEach(() => {
  Math.random = mulberry32(TEST_RANDOM_SEED)
})

// content の SQLite→.js フォールバック告知（contentFallback.js の console.warn）を抑止する。
// テスト環境（node は document 未定義／jsdom は実サーバ無しで fetch 失敗）では、教材読込は
// 設計どおり必ず .js フォールバックへ落ち、その告知が生スタックトレース付きで stderr に出て
// 「テストが失敗しているように見える」ノイズになる（実際はフォールバック成功＝正常系）。
// この [content] 告知の表示だけを止め、他の警告は素通しする。フォールバックの listener 通知
// （観測性）は recordContentFallback 側で維持されるため、テストの検証対象には影響しない。
const originalWarn = console.warn.bind(console)
console.warn = (msg, ...rest) => {
  if (typeof msg === 'string' && msg.startsWith('[content]')) return
  originalWarn(msg, ...rest)
}
