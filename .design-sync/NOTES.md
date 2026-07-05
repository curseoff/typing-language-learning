# design-sync ノート（typing-language-learning）

このリポジトリは**アプリ**（配布用コンポーネントライブラリではない）。design-sync の package 形式を
エスケープハッチで通している。再シンク時は以下を守ること。

## 前提（毎回・特にフレッシュclone後）
- **自己インストールの擬似シンボリックリンク**：`ln -sfn "$(pwd)" node_modules/typing-language-learning`
  （コンバータが node_modules/<pkg>/package.json を要求するため。node_modules は gitignore なので毎clone再作成）。
- **手書きエントリ** `.design-sync/tll-entry.mjs` を `--entry` で渡す（package.json の main が
  electron/main.cjs なので、放置すると Electron/Node 組込みを bundle しようとして失敗する）。
- 型なし（TS不使用）なので .d.ts は空。@types/react は repo の node_modules に無く props は空ボディ。これは想定内。

## スコープ（25コンポーネント）
- general: Ready（TOP全体・3タブ実描画）/ Result（成績サマリ）
- shared: Flow / Stat / StatsRow / RubyText / MaskedRubyText / OptionJa / QuizOptionLabel
- ready: TouchSection / EndConditionSelect / ItemList / WordsSection / DictSection / WordSentenceSection / StorySection
- result: RecordsTable / SegStatsTable ・ sound: SoundToggle ・ touch: Keyboard / TouchView
- marathon: Passage / TranslateView / MarathonView ・ story: StoryView（物語エンジンが第1ノードを実描画）
- **cfg.overrides**: SoundToggle={cardMode:single}（fixed）, TouchView={cardMode:column}（幅広）。GRID_OVERFLOW 対策。
- **プレビュー helper**: `buildPassage`（domain/marathon）をエントリで非コンポーネント export。Passage/TranslateView/MarathonView は
  pool `{word,en,ja,kana}` から `buildPassage(mode,pool,{target})` で**実 segment を生成**して描画（mode: 'en'/'both'/'en-tr' 等）。
- **PWA系（InstallButton/OfflineBanner/UpdateToast/ContentFallbackNotice）は除外**：hook 状態が無いと null 返し＝静的描画不可。
- **RecordDetail は除外**：モーダルで rich な record（segStats/choices/words/record 等）が必要。最小モックでは閉じるバーのみで空。追加するなら実 record 形の調査が要る。

## ビルド手順（重いデータはスタブ必須）
重いセクション（WordsSection/DictSection/WordSentenceSection）は教材データを動的importするため、
そのままだと _ds_bundle.js が 18.9MB になりアップロード上限 5MB を超える。ビルド時だけデータを空スタブに
差し替え、直後に content-build で再生成して復元する（trap で必ず復元）。

- スタブ対象: src/content/{wordsData,dictionaryData}.js=空配列 / {wordRubyData,wordGlossData}.js=空オブジェクト / wordSentences/L1-L4.js=空配列
- **stories はスタブ不要**（小さいので実データのまま含めてよい。StorySection は実データで描画）
- スタブ後の _ds_bundle.js は約660KB（<5MB）
- 復元コマンド: `node scripts/content-build.mjs`（生成データを再生成。gitignore なので commit されない）
- 手順スクリプト例: スタブ→package-build.mjs（--entry ./.design-sync/tll-entry.mjs）→content-build 再生成、を trap 付きシェルで実行

## プレビュー（provider）
- **DSFrame**（tll-entry.mjs 内で定義・cfg.provider）が全プレビューを background:var(--bg)/color:var(--text) の
  ダーク地で包む。ダークテーマ前提の淡色テキストが白カード上で不可視になるのを防ぐため必須。

## Known render warns
- Ready は floor card（未執筆・非失敗）。他は bad/thin/variantsIdentical=0。
- MaskedRubyText/OptionJa は仕様上「淡色/マスク」表示で正常。RecordsTable は空状態（まだ記録がありません）。

## Re-sync risks（次回が黙って古くなる箇所）
- **シンボリックリンクと手書きエントリ**が無いと即失敗する（上記「前提」を必ず実施）。
- **データスタブを忘れると 5MB 超過**で `[FILE_OVER_5MB]`。重いセクションを触る時は必ずスタブ→ビルド→再生成。
- `.design-sync/tll-entry.mjs` の export と `cfg.componentSrcMap` は手動同期。コンポーネント追加/削除時は両方を編集。
- previews の props はコンポーネント API 変更に追随しない（型が無いので検出されない）。API を変えたら previews を目視更新。
- 新しく重いデータ依存コンポーネントを足す時はスタブ対象の追加漏れに注意（ビルドサイズで確認）。
