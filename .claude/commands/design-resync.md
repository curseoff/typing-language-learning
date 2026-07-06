---
description: App→claude.ai/design の順方向ミラー更新を1コマンドで。アプリの UI 部品を直したら、これで Design 側の同期プロジェクトを最新化する。
argument-hint: "（引数不要。データ依存の重いセクションを含むため常にスタブビルドする）"
---

`.design-sync/` の同期入力（`config.json`・`tll-entry.mjs`・`previews/`）から、claude.ai/design のデザインシステム・プロジェクトを**最新化（ミラー更新）**する。App→Design の順方向。**日本語で報告**する。

## 前提
- `.design-sync/config.json` に `projectId` と `componentSrcMap` がある（初回構築は `/design-sync`）。
- 手順・スタブ対象・provider 等の詳細は **`.design-sync/NOTES.md`** を必ず先に読む（このリポジトリ固有のハックが書いてある）。

## 手順
1. **NOTES を読む**：`.design-sync/NOTES.md`。特に「前提（毎回）」「ビルド手順（スタブ必須）」「cfg.overrides」。
2. **スクリプト再配置**：`cp -r "<design-sync skill base>"/{package-build.mjs,package-validate.mjs,package-capture.mjs,resync.mjs,lib,storybook} .ds-sync/`（stale な `.ds-sync/` が古いコンバータを動かすのを防ぐ）。無ければ依存も入れる（`cd .ds-sync && npm i esbuild ts-morph @types/react`）。playwright 未導入なら render 検証は skip 可（`--no-render-check`）か本人に確認。
3. **自己インストール擬似リンク**：`ln -sfn "$(pwd)" node_modules/typing-language-learning`（gitignore・毎回必要）。
4. **スタブ→ビルド→再生成**（trap で必ず復元）：
   - スタブ: `src/content/{wordsData,dictionaryData}.js`→`export default []` / `{wordRubyData,wordGlossData}.js`→`export default {}` / `wordSentences/L1-L4.js`→`export default []`
   - `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./.design-sync/tll-entry.mjs --out ./ds-bundle`
   - 復元: `node scripts/content-build.mjs`（生成データを再生成。gitignore なのでコミットされない）
   - `_ds_bundle.js` が 5MB 未満であること（`[FILE_OVER_5MB]` が出たらスタブ漏れ）。
5. **検証**：`node .ds-sync/package-validate.mjs ./ds-bundle`（render check クリーン・`bad` 0・`SYNC_STALE`/`GRID` なし）。`node .ds-sync/package-capture.mjs --out ./ds-bundle` でグレードが carried forward すること。
6. **リモート差分の把握**：`DesignSync(get_project)` で `projectId` が生きていることを確認。`DesignSync(list_files)` で既存を把握（このプロジェクトは通常 `_ds_sync.json` を持つ非空＝再同期）。
7. **アップロード（アンカーは最後）**：`DesignSync(finalize_plan localDir:"./ds-bundle")` → 承認 → 番兵 `_ds_needs_recompile` を先に → 本体を ≤256/回で（大きい時は分割）→ **削除照合**（旧ファイルで今のビルドに無いものを `delete_files`）→ 番兵再アーム → **`_ds_sync.json` を単独で最後に**。
8. **確認・報告**：`DesignSync(list_files)` で件数一致を確認。プロジェクト URL（`https://claude.ai/design/p/<projectId>`）、同期したコンポーネント数、変更点を報告。durable set（config/previews/conventions/NOTES）に差分があればコミットを提案（push/PR は指示があるときだけ）。

## 注意
- **データ復元を必ず行う**（trap 付きシェルで実行）。忘れても次の `npm run` 系が再生成するが、明示的に戻す。
- 重いセクションを新規に足した時はスタブ対象の追加漏れに注意（ビルドサイズで確認）。
- 逆方向（Design で作った画面を実装）は **`/import-design`**。
