// 単語例文の遅延読み込み。初回バンドルに全例文(約6MB)を含めないよう、レベル別に分割し動的importする。
// アプリ側はこの index 経由でアクセス（静的に全件 import しないこと）。Node ツールは ./all.js を使う。
export const WSENT_COUNTS = {"1":749,"2":1873,"3":1307,"4":15145}
const loaders = { 1: () => import('./L1.js'), 2: () => import('./L2.js'), 3: () => import('./L3.js'), 4: () => import('./L4.js') }
export const loadWsentLevel = (level) => loaders[level]().then((m) => m.default)
// 全レベルの例文を読み込んで連結（復習デッキ用。約6MBを取得するので開始時のみ）。
export const loadAllWsent = () =>
  Promise.all([1, 2, 3, 4].map(loadWsentLevel)).then((a) => a.flat())
