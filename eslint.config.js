import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
  // .claude/workflows は Workflow ランタイム専用DSL（トップレベル return 等）なので lint 対象外
  // 教材の生成物（content/*.ndjson・stories/*.json から生成）は lint 対象外
  {
    ignores: [
      'dist',
      'release',
      'node_modules',
      'packages/*/dist',
      '.claude',
      'coverage',
      // Storybook のビルド出力（storybook build の生成物）は lint 対象外
      'storybook-static',
      // design-sync のツール・生成物・プレビュー入力（アプリのソースではない）は lint 対象外
      '.design-sync',
      '.ds-sync',
      'ds-bundle',
      'src/content/wordsData.js',
      'src/content/dictionaryData.js',
      'src/content/dictMeta.js',
      'src/content/wordGlossData.js',
      'src/content/wordSentences/L*.js',
      'src/content/wordSentences/theme.js',
      'src/content/wordSentences/wsentCounts.js',
      'src/content/stories/travel.js',
      'src/content/stories/climbing.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // 新JSX変換ではReactのimport不要
      'react/prop-types': 'off', // PropTypesは使わない
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // packages/ui は TS/TSX（@tll/ui の共有 UI 正本）。型認識のため tseslint parser を使う。
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // .d.ts の ambient 宣言や未使用は TS 側で検出するため base ルールは無効化
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // packages のビルド設定（vite.config.ts）は Node グローバルを許可
    files: ['packages/**/*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // テスト/設定スクリプトは Vitest/Node のグローバルを許可
    files: ['**/*.test.{js,jsx}', 'scripts/**', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Electron メインプロセスは CommonJS（__dirname/process など）
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
]
