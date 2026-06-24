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
    // ドメイン層は純粋関数なので node 環境。UI（src/ui 配下）のテストだけ jsdom にする。
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // コード（ロジック）のみ対象。データ/エントリ/テストは除外。
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/content/**', 'src/test/**', 'src/main.jsx'],
      // 退行防止のゲート（現状値の少し下。下回ると coverage が失敗）
      thresholds: { statements: 52, branches: 72, functions: 60, lines: 52 },
    },
  },
})
