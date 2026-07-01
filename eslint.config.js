import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  // .claude/workflows は Workflow ランタイム専用DSL（トップレベル return 等）なので lint 対象外
  // 教材の生成物（content/*.ndjson・stories/*.json から生成）は lint 対象外
  {
    ignores: [
      'dist',
      'release',
      'node_modules',
      '.claude',
      'coverage',
      'src/content/wordsData.js',
      'src/content/dictionaryData.js',
      'src/content/wordGlossData.js',
      'src/content/wordSentences/L*.js',
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
