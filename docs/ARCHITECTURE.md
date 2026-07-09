# 設計（ARCHITECTURE）

ドメイン駆動設計（DDD）のレイヤード構成です。React から純粋なドメインロジックを隔離しています。
共有部品は workspace パッケージ（`@tll/core` / `@tll/ui`）へ切り出し、アプリと claude.ai/design が同じ正本を参照します（Issue #233）。

## 依存方向と規約

- 依存は内向き：`ui → application → domain`、`application → infrastructure`、各層 → `content`（データ）
- パッケージ方向：`app(src) → @tll/ui → @tll/core`、`app → @tll/core`（外向きに `@tll/*` を参照しない＝正）
- `domain` と `@tll/core` は React/DOM に依存しない純粋ロジック
- `@tll/ui` の presenter は**純粋描画**：`content`/`application`/`infrastructure`/フックを import しない（props と node prop だけで描く）
- 命名規約：**`.js` = ドメイン/データ、`.jsx` = UI（app）／`.ts`・`.tsx` = パッケージ（`@tll/core` は既存 `.js` のまま）**

## パッケージ（共有正本）

`packages/*` は npm workspace。アプリはこれを **薄板（re-export shim）** と **container** から参照する。

- **`@tll/core`（`packages/core`, JS）** … React/DOM 非依存の純粋ドメイン。`romaji`（かな⇄ローマ字）と `typing/progress`（入力進捗・漢字アライメント）を公開。app と `@tll/ui` の両方が参照する。
- **`@tll/ui`（`packages/ui`, TS）** … プレイ/準備/結果画面の **presenter**（純粋描画・37部品）。vite lib build ＋ `tsc --emitDeclarationOnly` で `dist/`（`index.js` / `index.d.ts` / `styles.css`）を出力。`npm run build:pkgs` で生成し、`npm run check` が型ゲートとして通す。
- **container/presenter 分離** … フックの状態機械と data 配線は app 側の container（`src/ui/**`）に残し、presenter へ props で渡す。収録一覧や記録テーブルのような子は container が組み立てて `endConditionNode`/`browseNode`（React node prop）として presenter に渡す（browseNode パターン）。app の `src/ui/**` は presenter を再エクスポートする薄板か、上記 container のいずれか。

## 視覚カタログ（@tll/ui の閲覧）

- **design-sync**（`.design-sync/`）… `@tll/ui` を入力に claude.ai/design プロジェクトへ同期する共有正本。`componentSrcMap`（部品名↔`packages/ui/src`）を台帳に、順方向 `/design-resync`・逆方向 `/import-design` の双方向で使う。詳細は `.design-sync/NOTES.md`。
- **Storybook**（`.storybook/`）… `packages/ui/src/**/*.stories.tsx` を開発中に閲覧する部品ギャラリー。`npm run storybook`（dev）/ `npm run build-storybook`（静的）。どちらもダークテーマ地で描く（`src/App.css` の `:root` トークンを供給）。

## ディレクトリ構成

```
.
├─ index.html / vite.config.js / package.json / LICENSE(MIT)
├─ eslint.config.js                ESLint(Flat config)
├─ scripts/validate-sentences.mjs  教材データの整合性チェック（npm run validate）
├─ .github/workflows/              ci.yml（check）/ deploy.yml（Pages公開）
├─ .storybook/                     Storybook 設定（@tll/ui の部品ギャラリー）
├─ .design-sync/                   claude.ai/design 同期（@tll/ui を共有正本に）
├─ packages/
│  ├─ core/src/                    @tll/core：純粋ドメイン（romaji / typing/progress）
│  └─ ui/src/                      @tll/ui：presenter（TS・純粋描画・*.test.tsx / *.stories.tsx を colocate）
│     ├─ shared/{Text,Stats,Flow,QuizOptionLabel,OptionJa,PlayResultView}.tsx
│     ├─ ready/{parts,EndConditionSelect,ItemList,RankSectionView,StorySectionView}.tsx
│     ├─ marathon/{Passage,TopFlow,TranslateView}.tsx ・ result/{Result,RecordsTable,SegStatsTable}.tsx
│     ├─ story/StoryView.tsx ・ words/WordsView.tsx ・ dictionary/DictView.tsx ・ touch/{TouchView,Keyboard}.tsx ・ romaji/{RomajiView,KanaTable}.tsx
│     └─ menu/MenuBarView.tsx（メニューバー）・ sound/SoundToggle.tsx
└─ src/
   ├─ main.jsx / App.jsx           エントリ／合成（状態・ナビ・画面ルーティング）
   ├─ App.css
   │
   ├─ domain/                      純粋ロジック（Reactなし、*.test.js あり）
   │  ├─ romaji/romaji.js          かな⇄ローマ字エンジン（複数綴り受理／canonical）
   │  ├─ typing/{units,progress}.js  セグメント生成／入力進捗・漢字位置変換
   │  ├─ marathon/{passage,scoring}.js  出題（600文字）／採点
   │  ├─ story/navigation.js       物語グラフのナビゲーション
   │  ├─ words/wordset.js          単語の出題・4択生成
   │  ├─ dictionary/dictset.js     英英の出題・4択・説明4択生成
   │  ├─ touch/drill.js            タッチタイピングの出題列生成
   │  └─ records/{ranking,recordKeys}.js  ランキングのルール（rankInsert）／記録の識別キー生成
   │
   ├─ content/                     教材データ＋ラベル
   │  ├─ sentences.js（SENTENCES/RANKS）
   │  ├─ words.js（WORDS/WORD_LEVELS/WORD_THEMES/WORD_MODES）
   │  ├─ dictionary.js（DICT/DICT_MODES）
   │  ├─ story.js（STORY）
   │  ├─ keyboard.js（KEY_ROWS/FINGER/TOUCH_LEVELS）
   │  └─ modes.js（MODES/modeLabel/modeDesc）
   │
   ├─ infrastructure/              永続化（SQLite-WASM + OPFS）＋ブラウザAPI配線
   │  ├─ db/                       sqliteWorker（Workerで SQLite 実行）/ initStorage / schema・migrations（版付き）/ repos/*Db（records/word/dict/story/itemStats の DB I/O）
   │  ├─ persist/                  多タブ協調（multiTab）／外部自動バックアップ（externalBackupStore・FSA）／永続ストレージ取得（persistentStorage）
   │  ├─ pwa/                      registerSW（SW登録）/ installPrompt / onlineStatus
   │  └─ sound.js / soundSettingsRepository  効果音・音設定（音設定のみ localStorage 継続）
   │
   ├─ application/                 ユースケース（フック＝状態機械）＋永続化ファサード
   │  ├─ useMarathon.js / useStory.js / useWords.js / useWordQuiz.js / useDict.js / useDictQuiz.js / useTouch.js / useRomaji.js
   │  ├─ records.js                記録の読み書きファサード（sqlite/memory 2値・メモリ像＋write-through）
   │  ├─ persist/                  永続化の純ロジック（backend選択 / memoryStore / writeQueue / election主タブ選出 / recovery自動復元 / persistNotice）
   │  ├─ backup.js / externalBackup.js   エクスポート・インポート／外部自動バックアップ
   │  ├─ appMenu.js                メニュー項目の可否/理由（buildTopMenuVisibility）
   │  └─ itemTracker.js            問題ごとの打鍵/ミス/時間を集計し記録
   │
   └─ ui/                          プレゼンテーション（container ＋ 薄板 shim）
      ├─ menu/AppMenuBar.jsx        全幅メニューバー（アプリ名/データ の導線・MenuBarView を配線）
      ├─ shared/ ・ ready/{Ready,各Section}.jsx ・ marathon/{MarathonView,…}.jsx ・ romaji/
      ├─ result/{Result,RecordDetail,…}.jsx ・ records/AllRecordsView.jsx ・ story/ ・ words/ ・ dictionary/ ・ touch/
      └─ pwa/                       PWA 配線（OfflineBanner/UpdateToast/ContentFallbackNotice/PersistNotice ＋ hooks）
```

> `src/ui/**` の純粋描画部分は `@tll/ui` の presenter へ移設済み（上記パッケージ参照）。app 側は presenter を再エクスポートする薄板か、フック/データを配線して presenter を合成する container。PWA 配線は app 固有なので app 側に残す。

## 画面の流れ

`App.jsx` が `phase`（ready / playing / story / words / dict / touch / romaji / result / about / allrecords）と `gameType`（wsent / story / words / dict / touch / romaji）を持ち、種類に応じてビューへルーティングします。TOP のヘッダは全幅メニューバー（`ui/menu/AppMenuBar.jsx`）で、このアプリについて・すべての記録・データ（エクスポート/復元/外部バックアップ）の導線を集約します。各 `useXxx` フックが該当ゲームの状態機械（出題・打鍵判定・計測・記録保存）を担います。

## 主要な定数

- `TARGET_KEYS`（`domain/marathon/passage.js`）… 文章・単語入力の終了文字数（既定 600）
- `MAX_RECORDS`（`domain/records/ranking.js`）… ランキング保持件数（既定 15）
- 単語4択 30問 / 英英4択 20問 / 英英 説明4択・入力 12問（`domain/*/...set.js`）

## 技術メモ

- **ローマ字判定**：`domain/romaji/romaji.js` がかな読みから「許容する全ローマ字パターン」を展開して照合（`shi`/`si` などを同時許容）。表示は標準（ヘボン式）を既定にしつつ入力に追従。
- **漢字の進捗表示**：`domain/typing/progress.js` の `alignJaToKana` で漢字↔かなを簡易アライメントし、ローマ字入力の進捗を漢字位置に変換して色づける。送り仮名が読み先頭の同一かなへ誤マッチしないよう、漢字数ぶん先から照合する。
- **4択の進捗着色**：`ui/shared/QuizOptionLabel.jsx` が、打鍵済みプレフィックスを着色（漢字選択肢は読み→漢字位置へ変換）。
- **出題の長さ調整**：単語/英英の入力モードは「最短綴りで打っても600文字に届く」よう語を並べる（短い綴りで打ち切って詰むのを防止）。
- **速度** = 文字数 ÷ 経過分（打/分）。文章は1文ごとの速度・ミスも計測。
- **問題ごとの記録**：`application/itemTracker.js` が入力モードで「問題が切り替わるたび/終了時」に `application/records.js`（ファサード）経由で `item_stats`（SQLite）へ記録。id は `type:mode:key`（例 `w:en:reserve`）で**モード別**。収録一覧（`ui/ready/ItemList.jsx`）に練習回数・平均ミス・打/秒を表示。4択は対象外。
- **タッチタイピング**：`content/keyboard.js` の指割当でキーを色分けし、`useTouch` がドリル（既定40打）を進行。記録は保存しない。
- **永続化（SQLite-WASM + OPFS）**：記録は `application/records.js` ファサード経由で読み書きする。既定バックエンドは `sqlite`（OPFS の SQLite・Worker 実行）で、起動時にメモリ像へ hydrate し、以後は像を即時更新しつつ Worker へ write-through する。OPFS/Worker/Web Locks が使えない環境は `memory`（非永続・メモリのみ）へ縮退し告知する。多タブは Web Locks で主タブ1つを選出（副タブは read-only、主が閉じたら handoff で昇格）。起動時に整合性検査→破損なら内部バックアップから自動復元、外部フォルダ（File System Access）への自動バックアップにも対応。**localStorage による記録の永続化は廃止**（音設定など記録以外の localStorage は継続）。純ロジックは `application/persist/*`、DB I/O は `infrastructure/db/*`。

## テスト

ドメイン層に回帰テスト（`src/domain/**/*.test.js`）を置き、過去の不具合（漢字アライメント・600文字到達・4択の前方一致衝突 など）を固定しています。`@tll/ui` の presenter は代表 props で描画が落ちないことを確かめる smoke テスト（`packages/ui/src/**/*.test.tsx`）を colocate。coverage は `src/**` と `packages/*/src/**` を計測対象にし（`*.test.*`/`*.stories.*`/barrel は除外）、閾値は実測直下へ up-only でラチェットします。実行は `npm run test`／計測は `npm run coverage`（`npm run check` に含む）。
