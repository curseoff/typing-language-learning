# Claude 向け作業ガイド

このリポジトリで作業するときの規約。README/docs/コードから分かることは繰り返さない（毎セッション読まれるため簡潔に）。

## 応答・進め方
- **日本語で応答**する。
- **`git push` と PR 作成は、本人の明示指示があるときだけ**行う（指示が無ければやらない。完了後に push 用コマンドを案内するのは可）。その他の破壊的・外部公開（Issue/デプロイ等）も、まとめて委任されていなければ確認してから行う。
- **push の前に必ず自己点検**：未push差分（`origin/<branch>..<branch>`）に**公開して問題があるもの**（秘密情報＝APIキー/トークン/パスワード/秘密鍵・`.env`/鍵ファイル、氏名/メール等の個人情報の直書き、絶対パスでの username 露出 など）が無いか AI が判断し、**状況を本人に報告**してから push 指示を仰ぐ。リポジトリは PUBLIC。個人情報の実値はドキュメントに直書きせずプレースホルダにする。
- ユーザーの対応が必要で離席の可能性がある時は通知（PushNotification）。
- **エージェント体制**：司令塔（メイン）＋サブエージェント（`.claude/agents/`：coder＝実装／ddd-auditor・ui-auditor＝read-only監査／planner＝UX企画・Issue草案）。実装は coder に委任し、監査役で確認、push/PR/Issue作成/着手の判断は**本人**が行う。委任のたびに `tmp/agent-status.md`（稼働台帳・ローカルのみ／gitignore）を更新し、観測しやすいよう長めのタスクは `run_in_background:true` で起動する。本人は **`/team`** で各エージェントの稼働状況を確認できる。

## Git / PR ワークフロー
- ブランチ：`feature/*` → `develop` → `master`。**develop と master は乖離しうる**ので、新ブランチの起点と差分を毎回確認する。
- `gh` は必ず **`env -u GITHUB_TOKEN gh ...`**（不正な `GITHUB_TOKEN` 環境変数がキーチェーン認証を上書きするため）。
- **`Closes #N` は「feature→develop」と「develop→master」の両方のPR本文に書く**。自動クローズは **master（デフォルトブランチ）到達時のみ**発火する。develop止まりだと閉じない。
  - develop マージ時には **`on-develop` ラベルが自動付与**される（`.github/workflows/label-on-develop.yml` が PR の Closes/Fixes/Resolves #N を検出）＝「develop に乗った（リリース待ち）」の目印。master 到達で auto-close。だから feature→develop PR にも必ず `Closes #N` を書くこと。
- 何かを「完了」と言う前に必ず **`npm run check`**（lint→**coverage**→validate→build→check-bundle→audit ＝ **CI と同等**）を通す。**`check` が通れば CI も通る**。素早く回したい時は `npm run check:fast`（coverage の代わりに test）。
- **push 前フック**（`.githooks/pre-push`）が `check` を強制（CI赤の混入防止）。急ぐ時のみ `git push --no-verify`。**master/develop はブランチ保護で CI 緑必須**（赤ではマージ不可）。
- UI目視は **`npm run shots:play`**（dev 相手に `?preview=result|play|story` を撮影＝プレイ中/結果/記録を手動プレイ無しで確認）。リリースは **`npm run release -- <patch|minor|major>`**（本人実行：自己点検→版上げ→check→PR→マージ→Release→デプロイ）。
- **リリースPRの head は `release/*` ブランチ**にする（develop 直接にしない＝マージ時 auto-delete で develop が消えるため）。マージ後は develop と master を揃え、不要ローカルブランチを削除。詳細は docs/DEVELOPMENT.md。
- **リリース時は `package.json` の `version` を上げ**（TOP表示に出る）、master 反映後に **GitHub Release を作成**（タグ `vX.Y.Z`＝マージコミット、要約ノート）。`env -u GITHUB_TOKEN gh release create vX.Y.Z --target <フルSHA> --latest --title ... --notes ...`（`--target` はフルSHA必須）。

## コミット
- メッセージは**簡潔な日本語・辞書形**、`Co-Authored-By` 等のトレーラーは付けない。
- **修正したら毎回コミットまで自分で行う**（コミット案の提示で止めない）。push/PR は上記のとおり指示があるときだけ。
- **AI（私・coder等）のコミットは `scripts/ai-commit.sh -m "…"` で打つ**（AI名義・**ローカル鍵署名で1Password非依存**・Verified付き。識別子はローカル `git config ai.*` から読むので個人情報を書かない）。初回設定・詳細は docs/DEVELOPMENT.md「Git コミット（AI署名）」。人間（本人）の `git commit` は従来どおり。

## コンテンツ規約（src/content）
- 単語/英英/文章を足したら **`npm run validate`**（または `npm run check`）で必ず検証。
- 単語：`en` は一意、`level = bandOf(freq)`、`theme` は任意（`日常/旅行/ビジネス`）。
- **コンテンツは単語を軸に結ぶ**：英英＝その単語の意味を英語で説明、文章＝その単語を使った例文。詳細は docs/CONTENT.md。
- **英英は単語のサブセット**：`word` は必ず単語（words.js）に在る語にし、`level`/`theme` も単語に合わせる（validate強制）。新規英英は既存単語から作る。`def` は英小文字＋空白のみ。
- **カタカナ長音は読みも「ー」**で表す（ケーキ＝けーき。`-` キーで入力）。母音重ね（けえき）や脱落（けき）にしない。`づ`/`ぢ`・特殊拗音（ティ/ファ/チェ 等）の読みには注意。
- **大量追加は `npm run add-words <候補.tsv>`**（読み自動生成＋重複/読みの事前チェック、`-- --write` で追記）。**数千語規模は役割別サブエージェント並列**（生成→add-words→点検）。手順は docs/CONTENT.md。

## アーキテクチャ（詳細は docs/ARCHITECTURE.md）
- **`.js` = ドメイン/データ、`.jsx` = UI**。依存は内向き（`ui → application → domain`、`application → infrastructure`）。
- 既存の層構成・命名を壊さない。`domain` は React/DOM 非依存。

## 詳細ドキュメント
- 開発・スクリプト・CI・公開 … `docs/DEVELOPMENT.md`
- 設計・ディレクトリ … `docs/ARCHITECTURE.md`
- 教材データの追加・編集 … `docs/CONTENT.md`
