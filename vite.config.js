import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Electron(file://)で読み込めるよう相対パスにする
  base: './',
  plugins: [react()],
  test: {
    // ドメイン層は純粋関数なので node 環境でOK（UIテストを足す時に jsdom へ）
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
