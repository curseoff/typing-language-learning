# Claude 向け作業ガイド

このリポジトリで作業するときの規約。README/docs/コードから分かることは繰り返さない（毎セッション読まれるため簡潔に）。

## 応答・進め方
- **日本語で応答**する。
- **`git push` と PR 作成は、本人の明示指示があるときだけ**行う（指示が無ければやらない。完了後に push 用コマンドを案内するのは可）。その他の破壊的・外部公開（Issue/デプロイ等）も、まとめて委任されていなければ確認してから行う。
- ユーザーの対応が必要で離席の可能性がある時は通知（PushNotification）。

## Git / PR ワークフロー
- ブランチ：`feature/*` → `develop` → `master`。**develop と master は乖離しうる**ので、新ブランチの起点と差分を毎回確認する。
- `gh` は必ず **`env -u GITHUB_TOKEN gh ...`**（不正な `GITHUB_TOKEN` 環境変数がキーチェーン認証を上書きするため）。
- **`Closes #N` は「feature→develop」と「develop→master」の両方のPR本文に書く**。自動クローズは **master（デフォルトブランチ）到達時のみ**発火する。develop止まりだと閉じない。
- 何かを「完了」と言う前に必ず **`npm run check`**（lint→test→validate→build）を通す。
- **リリースPRの head は `release/*` ブランチ**にする（develop 直接にしない＝マージ時 auto-delete で develop が消えるため）。マージ後は develop と master を揃え、不要ローカルブランチを削除。詳細は docs/DEVELOPMENT.md。

## コミット
- メッセージは**簡潔な日本語・辞書形**、`Co-Authored-By` 等のトレーラーは付けない。
- **修正したら毎回コミットまで自分で行う**（コミット案の提示で止めない）。push/PR は上記のとおり指示があるときだけ。
- **AI（私）のコミットは専用の署名コマンドで打つ**（author/committer=AI名義・**ローカル鍵署名で1Password非依存**・Verified付き）。離席で 1Password がロックしても失敗しない。コマンドと理由は docs/DEVELOPMENT.md「Git コミット（AI署名）」。人間（本人）の `git commit` は従来どおり。

## コンテンツ規約（src/content）
- 単語/英英/文章を足したら **`npm run validate`**（または `npm run check`）で必ず検証。
- 単語：`en` は一意、`level = bandOf(freq)`、`theme` は任意（`日常/旅行/ビジネス`）。
- **英英は単語のサブセット**：`word` は必ず単語（words.js）に在る語にし、`level`/`theme` も単語に合わせる。新規英英は既存単語から選んで作る。`def` は英小文字＋空白のみ。
- **読みの落とし穴を避ける**：長音「ー」、`づ`/`ぢ`、特殊拗音（ティ/ファ/チェ 等）。
- **大量追加は `npm run add-words <候補.tsv>`**（読み自動生成＋重複/読みの事前チェック、`-- --write` で追記）。**数千語規模は役割別サブエージェント並列**（生成→add-words→点検）。手順は docs/CONTENT.md。

## アーキテクチャ（詳細は docs/ARCHITECTURE.md）
- **`.js` = ドメイン/データ、`.jsx` = UI**。依存は内向き（`ui → application → domain`、`application → infrastructure`）。
- 既存の層構成・命名を壊さない。`domain` は React/DOM 非依存。

## 詳細ドキュメント
- 開発・スクリプト・CI・公開 … `docs/DEVELOPMENT.md`
- 設計・ディレクトリ … `docs/ARCHITECTURE.md`
- 教材データの追加・編集 … `docs/CONTENT.md`
