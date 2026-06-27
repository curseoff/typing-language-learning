// 単語例文の遅延読み込み。初回バンドルに全例文(約6MB)を含めないよう、レベル別に分割し動的importする。
// アプリ側はこの index 経由でアクセス（静的に全件 import しないこと）。Node ツールは ./all.js を使う。
export const WSENT_COUNTS = {"1":{"すべて":749,"日常":220,"旅行":65,"ビジネス":40},"2":{"すべて":1873,"日常":295,"旅行":114,"ビジネス":191},"3":{"すべて":1307,"日常":175,"旅行":86,"ビジネス":103},"4":{"すべて":15145,"日常":304,"旅行":176,"ビジネス":473}}
const loaders = { 1: () => import('./L1.js'), 2: () => import('./L2.js'), 3: () => import('./L3.js'), 4: () => import('./L4.js') }
export const loadWsentLevel = (level) => loaders[level]().then((m) => m.default)
export const loadWsentThemes = () => import('./theme.js').then((m) => m.default)
