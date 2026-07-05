# design-sync ノート（typing-language-learning）

このリポジトリは**アプリ**（配布用コンポーネントライブラリではない）。design-sync の package 形式を
エスケープハッチで通している。再シンク時は以下を守ること。

## 前提（毎回・特にフレッシュclone後）
- **自己インストールの擬似シンボリックリンク**：`ln -sfn "$(pwd)" node_modules/typing-language-learning`
  （コンバータが `node_modules/<pkg>/package.json` を要求するため。node_modules は gitignore なので毎clone再作成）。
- **手書きエントリ** `.design-sync/tll-entry.mjs` を `--entry` で渡す（`package.json` の `main` が
  `electron/main.cjs` なので、放置すると Electron/Node 組込みを bundle しようとして失敗する）。
  ビルド：`node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./.design-sync/tll-entry.mjs --out ./ds-bundle`
- 型なし（TS不使用）なので `.d.ts` は空。`@types/react` は repo の node_modules に無く props は空ボディ。これは想定内。

## スコープ（TOP・10コンポーネント）
- 含む：TouchSection / EndConditionSelect / ItemList / QuizOptionLabel / OptionJa / Flow / Stat / StatsRow / RubyText / MaskedRubyText。
- **意図的に除外**：Ready / WordsSection / DictSection / WordSentenceSection / StorySection。
  → 教材データ（content/words.js=1.4MB, dictionary.js=4MB, wordSentences 数MB, stories）を transitively 取り込み、
  単体で 18.9MB になりアップロード上限 5MB を超えるため。含めるにはデータのスタブ化（要 lib/bundle.mjs 相当の改造）が必要。

## プレビュー（provider）
- **DSFrame**（tll-entry.mjs 内で定義・`cfg.provider`）が全プレビューを `background:var(--bg); color:var(--text)` の
  ダーク地で包む。ダークテーマ前提の淡色テキストが白カード上で不可視になるのを防ぐため必須。

## Known render warns
- 特になし（bad/thin/variantsIdentical=0）。MaskedRubyText/OptionJa は仕様上「淡色/マスク」表示で正常。

## Re-sync risks（次回が黙って古くなる箇所）
- **シンボリックリンクと手書きエントリ**が無いと即失敗する（上記「前提」を必ず実施）。
- `.design-sync/tll-entry.mjs` の export 一覧と `cfg.componentSrcMap` は手動同期。コンポーネントを足す/消す時は両方を編集。
- 5MB 制限：新規に重いデータ依存コンポーネントを足すとバンドル超過で `[FILE_OVER_5MB]`。
- previews の props はコンポーネント API 変更に追随しない（型が無いので検出されない）。API を変えたら previews を目視で更新。
