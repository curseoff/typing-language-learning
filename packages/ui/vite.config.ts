import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// lib mode: design-sync / Storybook 等の外部利用向け dist を生成する。
// アプリ本体は exports の `import` が指す src(.tsx) を vite が直接コンパイルするため、
// この build は外部配布用（M1 の検証項目）。
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    cssCodeSplit: false,
  },
})
