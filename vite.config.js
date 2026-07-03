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
      // 打鍵ミス効果音（sound/soundSettingsRepository/SoundToggle）にテストを追加し微増。実測直下へ追従。
      thresholds: { statements: 77.5, branches: 60.4, functions: 75.7, lines: 78.6 },
    },
  },
})
