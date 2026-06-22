# 設計（ARCHITECTURE）

ドメイン駆動設計（DDD）のレイヤード構成です。React から純粋なドメインロジックを隔離しています。

## 依存方向と規約

- 依存は内向き：`ui → application → domain`、`application → infrastructure`、各層 → `content`（データ）
- `domain` は React/DOM に依存しない純粋ロジック
- 命名規約：**`.js` = ドメイン/データ、`.jsx` = UI**

## ディレクトリ構成

```
.
├─ index.html / vite.config.js / package.json / LICENSE(MIT)
├─ eslint.config.js                ESLint(Flat config)
├─ electron/main.cjs               Electronメインプロセス
├─ scripts/validate-sentences.mjs  教材データの整合性チェック（npm run validate）
├─ .github/workflows/              ci.yml（check）/ deploy.yml（Pages公開）
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
   │  └─ records/ranking.js        記録ランキングのルール（rankInsert）
   │
   ├─ content/                     教材データ＋ラベル
   │  ├─ sentences.js（SENTENCES/RANKS）
   │  ├─ words.js（WORDS/WORD_LEVELS/WORD_THEMES/WORD_MODES）
   │  ├─ dictionary.js（DICT/DICT_MODES）
   │  ├─ story.js（STORY）
   │  ├─ keyboard.js（KEY_ROWS/FINGER/TOUCH_LEVELS）
   │  └─ modes.js（MODES/modeLabel/modeDesc）
   │
   ├─ infrastructure/              永続化（localStorage）
   │  ├─ recordsRepository / storyRepository / wordsRepository / dictRepository
   │  └─ itemStatsRepository       問題ごとの累積記録（収録一覧で表示）
   │
   ├─ application/                 ユースケース（フック＝状態機械）
   │  ├─ useMarathon.js / useStory.js
   │  ├─ useWords.js / useWordQuiz.js
   │  ├─ useDict.js / useDictQuiz.js
   │  ├─ useTouch.js               タッチタイピング
   │  └─ itemTracker.js            問題ごとの打鍵/ミス/時間を集計し記録
   │
   └─ ui/                          プレゼンテーション
      ├─ shared/{Text,Stats,Flow,QuizOptionLabel}.jsx + index.js
      ├─ ready/{Ready,ItemList}.jsx  スタート画面（種類タブ／記録ランキング・収録一覧）
      ├─ marathon/{MarathonView,TopFlow,TranslateView,Passage}.jsx
      ├─ result/{Result,RecordsTable,SegStatsTable}.jsx
      ├─ story/StoryView.jsx
      ├─ words/WordsView.jsx
      ├─ dictionary/DictView.jsx
      └─ touch/{TouchView,Keyboard}.jsx
```

## 画面の流れ

`App.jsx` が `phase`（ready / playing / story / words / dict / touch / result）と `gameType`（marathon / story / words / dict / touch）を持ち、種類に応じてビューへルーティングします。各 `useXxx` フックが該当ゲームの状態機械（出題・打鍵判定・計測・記録保存）を担います。

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
- **問題ごとの記録**：`application/itemTracker.js` が入力モードで「問題が切り替わるたび/終了時」に `itemStatsRepository`（`item-stats-v1`）へ記録。id は `type:mode:key`（例 `w:en:reserve`）で**モード別**。収録一覧（`ui/ready/ItemList.jsx`）に練習回数・平均ミス・打/秒を表示。4択は対象外。
- **タッチタイピング**：`content/keyboard.js` の指割当でキーを色分けし、`useTouch` がドリル（既定40打）を進行。記録は保存しない。

## テスト

ドメイン層に回帰テスト（`src/domain/**/*.test.js`）を置いています。過去の不具合（漢字アライメント・600文字到達・4択の前方一致衝突 など）をテストで固定しています。実行は `npm run test`。
