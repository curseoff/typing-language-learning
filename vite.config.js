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
    // #233 M7: @tll/ui（packages/ui）の presenter テスト（.tsx・各先頭で jsdom 指定）も拾う。
    include: ['src/**/*.test.{js,jsx}', 'packages/*/src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // コード（ロジック）のみ対象。データ/エントリ/テストは除外。
      // #233 M7: 移設済みの @tll/ui presenter（packages/*/src）も計測対象に含める。
      include: ['src/**/*.{js,jsx}', 'packages/*/src/**/*.{ts,tsx}'],
      // registerSW.js は import.meta.env.PROD で本番のみ走るブラウザ SW 配線（main.jsx と同種の
      // エントリ配線）で jsdom 単体テストの対象外。UI ロジックは UpdateToast.test.jsx で被覆する。
      // packages 側は re-export の barrel（index.ts）・型宣言・テストを計測から外す。
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/content/**',
        'src/test/**',
        'src/main.jsx',
        'src/infrastructure/pwa/registerSW.js',
        // SQLite/OPFS 保存基盤（#264）。Worker 内実行/Worker・window 配線・DDL データは
        // jsdom/node で単体計測できない＝registerSW.js と同種のエントリ配線として計測除外。
        // 実挙動は pwa-verifier の実ブラウザ検証と Phase2 の round-trip テストで被覆する。
        // runMigrations.js は純ロジック（テスト済み）なので除外しない。
        'src/infrastructure/db/sqliteWorker.js',
        'src/infrastructure/db/initStorage.js',
        'src/infrastructure/db/migrations.js',
        // #273 Phase3b: Web Locks 主タブ選出＋BroadcastChannel 伝播＋handoff 昇格の配線。
        // navigator.locks/BroadcastChannel/Worker は jsdom/node で単体計測できない＝上記 db/* と
        // 同種のブラウザ API エントリ配線として計測除外。純ロジック（election/secondaryMessage）は
        // 計測対象（各 spec で被覆）。実挙動は pwa-verifier の実ブラウザ検証で担保する。
        'src/infrastructure/persist/multiTab.js',
        // #267 Phase4: navigator.storage.persist() の取得配線と、Ready のバックアップバー UI。
        // navigator.storage / Blob ダウンロード / file input / location.reload は jsdom/node で
        // 単体計測できない＝上記 db/* と同種のブラウザ API エントリ配線として計測除外。純関数
        // （backup.js の looksLikeSqlite/buildBackupFilename/isValidUserDb）は計測対象（backup.test.js）。
        'src/infrastructure/persist/persistentStorage.js',
        'src/ui/ready/DataBackupBar.jsx',
        // #268 Phase5a: 永続化の縮退/復元の告知 UI とその購読フック。useSyncExternalStore/ブラウザ描画の
        // 薄い配線＝上記 UI 配線と同種で計測除外。状態源（application/persist/persistNotice.js）と判断
        // （application/persist/recovery.js）・facade（application/recovery.js）は計測対象（各 spec で被覆）。
        'src/ui/pwa/PersistNotice.jsx',
        'src/ui/pwa/usePersistNotice.js',
        'packages/*/src/**/*.test.{ts,tsx}',
        'packages/*/src/**/*.stories.tsx',
        'packages/*/src/index.ts',
        'packages/*/src/**/*.d.ts',
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
      // #233 M5（L4 Views: SoundToggle/TouchView/StoryView/WordsView/DictView の JSX を @tll/ui の
      // presenter へ移設、結果は共有 PlayResultView へ集約）で未被覆の分岐（4択の着色・結果内訳など）が
      // src 計測から外れ、src 実測が大きく上振れ（S84.4/B74.36/F82.85/L85.28）。実測直下へラチェット。
      // #233 M7: packages/*/src（@tll/ui presenter）を計測対象に加え、代表 props の smoke テストで主要
      // 描画パスを通した。全体実測は S84.78/B75.37/F83.76/L85.95 → 実測直下へラチェット（up-only）。
      // #240: buildQuizSegStat/segPush 透過/dict options en-ja/SegStatsTable 英日併記のテストを追加し
      // 実測が上振れ（S84.9/B75.79/F83.89/L86.06）→ 実測直下へラチェット（up-only）。
      // #244: 紹介ページ AboutView presenter＋App の about 導線/Esc 遷移のテストを追加し実測が上振れ
      // （S84.96/B75.81/F84.01/L86.13）。ただし v8 の計測は実行ごとに数行揺れ（lines 実測 86.06〜86.13 等）、
      // 実測直下（0.03下）だと確率的に閾値割れ→CI/pre-push が不安定になる。up-only の精神は保ちつつ
      // 揺れ幅分のマージンを取り 0.1 単位で切り捨てる。
      // #248: 全記録横断ビュー（allRecords 純関数＋AllRecordsView presenter）のテストを追加し functions が
      // 上振れ（実測 F84.21）→ functions のみ 84.0 へラチェット（揺れ分マージン維持・他は据え置き）。
      // #248: 物語記録の終了条件別バリアント集約（loadAllStoryRecords）＋単体テスト追加で
      // 実測が上振れ（S85.03/B75.92/F84.24/L86.14）→ 各項目を実測直下へラチェット（揺れマージン維持）。
      // #250: 全記録の各行に raw/siblings/position を付与し、AllRecordsView の行クリックで記録詳細へ
      // 遷移する配線＋container 結合テスト・presenter の onRowClick smoke を追加し実測が上振れ
      // （S85.37/B76.61/F84.75/L86.48）。v8 の実行ごとの揺れ（±0.1程度の実績）に確実に耐えるよう
      // 実測から ≈0.25 のマージンを取り 0.1 単位で切り捨てる（実測直下すぎると pre-push/CI が確率的に割れる）。
      // #257: ローマ字入力練習（useRomaji 状態機械＋結合テスト・RomajiView/KanaTable presenter smoke・
      // App スモークにローマ字タブの完走/記録保存を追加）で実測が上振れ（S85.64/B76.77/F85.23/L86.77）→
      // 各項目を実測から ≈0.3 のマージンで実測直下へラチェット（揺れマージン維持・up-only）。
      thresholds: { statements: 85.3, branches: 76.4, functions: 84.9, lines: 86.4 },
    },
  },
})
