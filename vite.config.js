import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  // Electron(file://)で読み込めるよう相対パスにする
  base: './',
  plugins: [react()],
  // sqlite-wasm は事前バンドルすると .wasm の locate に失敗しがちなので最適化から除外。
  // 教材コンテンツを content.sqlite3 から読む contentDb.js が動的 import する。
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  // package.json の version をビルド時に注入（TOPに表示）
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    // ドメイン層は純粋関数なので node 環境（既定）。UIテストは各ファイル先頭の
    // `// @vitest-environment jsdom` で個別に jsdom を指定する（vitest 4 で environmentMatchGlobs 廃止）。
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // コード（ロジック）のみ対象。データ/エントリ/テストは除外。
      include: ['src/**/*.{js,jsx}'],
      // registerSW.js は import.meta.env.PROD で本番のみ走るブラウザ SW 配線（main.jsx と同種の
      // エントリ配線）で jsdom 単体テストの対象外。UI ロジックは UpdateToast.test.jsx で被覆する。
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/content/**',
        'src/test/**',
        'src/main.jsx',
        'src/infrastructure/pwa/registerSW.js',
      ],
      // 退行防止のゲート（coverage-v8 4 の計測基準での現状値の少し下）。
      // #233 M2（romaji/progress を @tll/core へ、Text系/Flow/marathon を @tll/ui へ移設）で
      // 未使用だった Passage.jsx が src 計測から外れ、薄板化で src の実測が上振れ。実測直下へ追従。
      // #233 M3（Keyboard/parts presenter/EndConditionSelect presenter を @tll/ui へ移設）で
      // branches 実測が一時微減したが、src 側 domain/application の未被覆分岐にテストを追加して回復
      // （branches 64.67%）。閾値は下げず 64.0 へ戻す（実測直下）。
      // #233 M4（container/presenter 分離：ItemList/RecordsTable/Result/各 Section の JSX を @tll/ui の
      // presenter へ移設）で未被覆の JSX が src 計測から外れ、src 実測が上振れ（S82.69/B65.82/F81.35/L83.59）。
      // 実測直下へラチェット（上げる方向のみ）。
      thresholds: { statements: 82.0, branches: 65.0, functions: 80.0, lines: 83.0 },
    },
  },
})
