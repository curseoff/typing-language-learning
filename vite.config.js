import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  // Electron(file://)で読み込めるよう相対パスにする
  base: './',
  plugins: [react()],
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
      exclude: ['src/**/*.test.{js,jsx}', 'src/content/**', 'src/test/**', 'src/main.jsx'],
      // 退行防止のゲート（coverage-v8 4 の計測基準での現状値の少し下）。
      thresholds: { statements: 71, branches: 52.5, functions: 70.5, lines: 72.5 },
    },
  },
})
