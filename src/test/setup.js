// Vitest セットアップ（UIテスト用）。jest-dom のマッチャ（toBeInTheDocument 等）を有効化。
import '@testing-library/jest-dom/vitest'

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
