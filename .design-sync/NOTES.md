# design-sync ノート（typing-language-learning）

design-sync の入力を**正本パッケージ `@tll/ui`**（`packages/ui`・TS presenter・vite lib build）に切り替えた（Issue #233 / M6）。
これにより旧来のハック（自己シンボリックリンク・手書き全 src 列挙エントリ・データスタブ）は**すべて不要**になった。
`@tll/ui` は正規の workspace パッケージで、重い教材データを import せず、tsc 生成の**実 .d.ts 型**を持つ。

## 前提（毎回）
- **ビルド**：`@tll/ui` を先にビルドしておく（`npm run -w @tll/ui build`＝vite lib + tsc d.ts）。
  design-sync は `pkg: "@tll/ui"` を解決し、`cssEntry: packages/ui/dist/styles.css` を読む。
- **エントリ** `.design-sync/entry.mjs`：`export * from '@tll/ui'` ＋ プレビュー用 provider `DSFrame` だけ。
  electron 回避のための手書き列挙はもう無い（main が electron/main.cjs でも `@tll/ui` を解決するので影響しない）。
- シンボリックリンク・データスタブは**不要**。フレッシュ clone 後も `@tll/ui` の build だけでよい。

## スコープ（37 コンポーネント）
`cfg.componentSrcMap`（部品名↔`packages/ui/src` 実パス）が正本一覧。両方向コマンドもこれを共有台帳に使う。
- shared: Stat / StatsRow（Stats.tsx）/ Chars / RubyChars / RubyTyped / RubyText / MaskedRubyText / Typed / MaskedText / Chips（Text.tsx）/ OptionJa / QuizOptionLabel / Flow / PlayResultView
- ready: ModeButtons / SectionLabel / BottomTabs / StartRow（parts.tsx）/ EndConditionSelect / ItemList / RankSectionView / StorySectionView
- result: RecordsTable / SegStatsTable / Result ・ sound: SoundToggle ・ story: StoryView
- marathon: Passage / TranslateView / TopFlow ・ touch: Keyboard / TouchView
- words: WordTypeView / WordQuizView（WordsView.tsx）・ dictionary: DictTypeView / DictQuizView / DictPickView（DictView.tsx）
- **cfg.overrides**：SoundToggle={cardMode:single, primaryStory:On}, TouchView={cardMode:column}。GRID_OVERFLOW 対策。

## container/presenter 分離
`@tll/ui` は純粋 presenter（フック非依存）。フック state は container が props で渡す。
`RankSectionView`/`StorySectionView` は `EndConditionSelect`/`ItemList`/`RecordsTable` を
`endConditionNode`/`browseNode`（React node prop）として受ける「browseNode」パターン。
プレビューは pool/固定 props から node を組んで渡す（データ配線は不要）。

## プレビュー（provider）
- **DSFrame**（`entry.mjs` 内で定義・`cfg.provider`）が全プレビューをダーク地で包む。
  `@tll/ui` は「ダークテーマ専用」で `var(--*)` を前提に描くが、`dist/styles.css` は**コンポーネント CSS だけ**で
  `:root` トークンを含まない設計。そのため DSFrame のラッパ要素に `--bg`/`--text` 等のパレットを定義して
  子孫へ継承させる（値は `src/App.css` の `:root` と同一）。これが無いと白カード上で淡色テキストが不可視になる。

## Known render warns
- bad/thin/variantsIdentical=0（floor card なし＝全コンポーネント authored）。
- MaskedRubyText/OptionJa は仕様上「淡色/マスク」表示で正常。SectionLabel/StartRow/Chars/Typed 等の小部品は本質的に小さい表示で正常。

## Re-sync risks（次回が黙って古くなる箇所）
- **`@tll/ui` の build 忘れ**：`dist/` が古いとプレビューも古い。再シンク前に必ず build。
- **componentSrcMap の手動同期**：`packages/ui` に部品を足す/消す/移す時は `config.json` の componentSrcMap を編集。
  `entry.mjs` は `export *` なので追随するが、map に無い部品はカード化されない。
- **presenter API 変更**：`.tsx` の props を変えたら、対応する `_preview/*.js`（design-sync が生成）は
  次回シンクで再生成されるが、プレビューの与える props はコマンド/skill 側の生成ロジック依存。API を大きく変えたら目視確認。
- 削除した部品（旧 Ready/MarathonView/DictSection/StorySection/TouchSection/WordRecords/WordSentenceSection/WordsSection/RecordDetail）は
  M6 で presenter 化・統合済み。復活させない。

## 双方向ワークフロー（コマンド）
- **順方向 App→Design**: `/design-resync`（`@tll/ui` を直したら Design ミラーを最新化）。build→シンクを1コマンド化。
- **逆方向 Design→App**: `/import-design <画面コード|URL>`（Design で組んだ画面を `packages/ui`/`src` へ移植）。
  import 張替えは `componentSrcMap` を共有台帳に使う。データ配線・挙動は `TODO(import-design)` で人に残す（半自動）。
- 共有の要は **`.design-sync/config.json` の componentSrcMap**（部品名↔`packages/ui/src` 実パス）。両方向がこれを使う。
