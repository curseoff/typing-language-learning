# Claude 向け作業ガイド

このリポジトリで作業するときの規約。README/docs/コードから分かることは繰り返さない（毎セッション読まれるため簡潔に）。

## 応答・進め方
- **日本語で応答**する。
- 破壊的・外部公開（push/PR/Issue/デプロイ等）は、まとめて委任されていなければ確認してから行う。
- ユーザーの対応が必要で離席の可能性がある時は通知（PushNotification）。

## Git / PR ワークフロー
- ブランチ：`feature/*` → `develop` → `master`。**develop と master は乖離しうる**ので、新ブランチの起点と差分を毎回確認する。
- `gh` は必ず **`env -u GITHUB_TOKEN gh ...`**（不正な `GITHUB_TOKEN` 環境変数がキーチェーン認証を上書きするため）。
- **`Closes #N` は「feature→develop」と「develop→master」の両方のPR本文に書く**。自動クローズは **master（デフォルトブランチ）到達時のみ**発火する。develop止まりだと閉じない。
- 何かを「完了」と言う前に必ず **`npm run check`**（lint→test→validate→build）を通す。
- **リリースPR（→master）の head は `develop` 直接ではなく `release/*` ブランチにする**（`release/* ← develop` を作って `release/* → master` でPR）。リポジトリは**マージ時 auto-delete** が有効で、develop を head にすると develop ごと削除されるため。release ブランチなら develop が残る。
- マージ後は **develop と master を揃え**、**マージ済みのローカル feature/release ブランチを削除**する。万一 develop が消えていたら **master と同一内容で develop を再作成**して push する。

## コミット
- メッセージは**簡潔な日本語・辞書形**、`Co-Authored-By` 等のトレーラーは付けない。
- 通常はコミット案（実行可能なコマンド）を提示。複数ステップをまとめて委任された時は自分でコミットしてよい。
- **AI（私）が打つコミットは必ず次の形**にする：author・committer とも **AI 名義**／**ローカル署名鍵（1Password非依存）**。離席で 1Password がロックしても失敗せず、AI 製と分かり Verified も付く。
  ```bash
  GIT_COMMITTER_NAME="Atsushi Yamaguchi (AI)" GIT_COMMITTER_EMAIL="libertyrh@gmail.com" \
  git -c gpg.ssh.program=ssh-keygen -c user.signingkey=~/.ssh/ai-signing.pub \
    commit --author="Atsushi Yamaguchi (AI) <libertyrh+ai@gmail.com>" -m "..."
  ```
  - **committer のメールは検証済みの `libertyrh@gmail.com`**（名前は `(AI)`）。GitHub の Verified は committer メールが検証済みであることを要件にするため。author のメールは `libertyrh+ai@gmail.com`。
  - 人間（本人）の `git commit` は従来どおり（本人名義・1Password 署名）。グローバル/リポジトリ設定は変更しない（上書きは `-c` でその場限り）。
  - 署名鍵 `~/.ssh/ai-signing` はパスフレーズなし。公開鍵は GitHub に signing key 登録済み。

## コンテンツ規約（src/content）
- 単語/英英/文章を足したら **`npm run validate`**（または `npm run check`）で必ず検証。
- 単語：`en` は一意、`level = bandOf(freq)`、`theme` は任意（`日常/旅行/ビジネス`）。
- **読みの落とし穴を避ける**：長音「ー」、`づ`/`ぢ`、特殊拗音（ティ/ファ/チェ 等）。英英 `def` は英小文字＋空白のみ。
- **大量追加は `npm run add-words <候補.tsv>`**（読み自動生成＋重複/読みの事前チェック）。`-- --write` で words.js に追記。詳細は docs/CONTENT.md。

## アーキテクチャ（詳細は docs/ARCHITECTURE.md）
- **`.js` = ドメイン/データ、`.jsx` = UI**。依存は内向き（`ui → application → domain`、`application → infrastructure`）。
- 既存の層構成・命名を壊さない。`domain` は React/DOM 非依存。

## 詳細ドキュメント
- 開発・スクリプト・CI・公開 … `docs/DEVELOPMENT.md`
- 設計・ディレクトリ … `docs/ARCHITECTURE.md`
- 教材データの追加・編集 … `docs/CONTENT.md`
