// 単語例文の遅延読み込み。初回バンドルに全例文(約6MB)を含めないよう、レベル別に分割し動的importする。
// アプリ側はこの index 経由でアクセス（静的に全件 import しないこと）。Node ツールは ./all.js を使う。
// WSENT_COUNTS は例文＋単語テーマからの派生物で content-build が wsentCounts.js を生成する（正準化）。
export { WSENT_COUNTS } from './wsentCounts.js'
// 例文本体は content.sqlite3（SQLite-WASM）から level 指定で読む。失敗時は生成物 L*.js にフォールバック。
const loaders = { 1: () => import('./L1.js'), 2: () => import('./L2.js'), 3: () => import('./L3.js'), 4: () => import('./L4.js') }
export const loadWsentLevel = async (level) => {
  try {
    return await (await import('../contentDb.js')).querySentences(level)
  } catch (e) {
    ;(await import('../contentFallback.js')).recordContentFallback('sentences', e)
    return (await loaders[level]()).default
  }
}
// テーマ絞り込みマップは小さいので生成 .js のまま（SQLite 化しない）。
export const loadWsentThemes = () => import('./theme.js').then((m) => m.default)
