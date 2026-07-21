# Claude 向け作業ガイド

このリポジトリで作業するときの規約。README/docs/コードから分かることは繰り返さない（毎セッション読まれるため簡潔に）。

## 応答・進め方
- **日本語で応答**する。
- **`git push` と PR 作成は、本人の明示指示があるときだけ**行う（指示が無ければやらない。完了後に push 用コマンドを案内するのは可）。その他の破壊的・外部公開（Issue/デプロイ等）も、まとめて委任されていなければ確認してから行う。
- **push の前に必ず自己点検**：**`npm run push-selfcheck`** を実行する（未push差分の追加行を走査し、秘密情報＝APIキー/トークン/パスワード/秘密鍵・`.env`/鍵ファイル、個人情報の直書き、絶対パスでの username 露出を検出）。**検出したら push せず本人に報告**する。リポジトリは PUBLIC。個人情報の実値はドキュメントに直書きせずプレースホルダにする。→ 詳細は `push-selfcheck` スキル。
- ユーザーの対応が必要で離席の可能性がある時は通知（PushNotification）。
- **エージェント体制**：司令塔（メイン）＋サブエージェント（`.claude/agents/`：coder／test-author／content-author／ddd-auditor／ui-auditor／pwa-verifier／bug-watcher／reviewer／planner）。実装は coder に委任し、監査役で確認、**push/PR/Issue作成/着手の判断は本人**が行う（例外：bug-watcher は常設許可で `bug` Issue の作成・更新・クローズを自律実行してよい＝確証のある不具合のみ）。**稼働台帳（`tmp/agent-status.tsv`）は各エージェントが自己更新**（着手時「実行中」／完了時「完了・要判断・要対応」を `npm run team:set` で upsert）。司令塔は自分の `commander` 行と全体監視（`npm run team`）を担う。長めのタスクは `run_in_background:true` で起動。→ **各役の守備範囲・起動タイミング・境界の切り分けは `agent-routing` スキル**。
- **bug-watcher の起動は (a) 本人の指示があったとき、または (b) リリース（develop→master マージ）の直前に司令塔が起動、のいずれか**。**develop へマージするたびの自動起動はしない**。リリース直前は司令塔が未リリース分（`origin/master..origin/develop`）を調査させ、結果を確認してからリリースへ進む（`run_in_background:true` 推奨・急ぐなら結果を待って判断）。bug-watcher は確証のある不具合だけ `bug` ラベルで Issue 化し、解消されたら同じ Issue を更新・クローズする。
- **TDD（テスト先行）＝ domain/application の「ロジック」と「バグ修正」に適用**。流れは **Red→Green→Refactor**：受け入れ条件（本人 or planner）→ **test-author** が失敗テスト(Red) → **coder** が通す最小実装(Green)→refactor。**coder は test-author の仕様テストを編集しない**（不備は司令塔に申告）。司令塔は「赤→緑」と「**coder の差分が `*.test.*` を触っていない**」を確認し、Red と Green をコミット分離する。**見た目・CSS・教材データは TDD 対象外**（従来どおり `check`/スクショ/`validate`）。
- **役割の受け渡し（リスク別／司令塔の裁量ブレを封じる）**。中間ホップは従来どおり司令塔が逐次オーケストレーション（成果物＝ブランチを介して各役へ渡す）。変更の性質で役を機械的に選ぶ。**司令塔ゲート：編集/検証に着手する前に下表で役を選び、表に載る種類を司令塔が直接手を動かさない**（教材＝content-author、純粋ロジック/バグ修正＝test-author 先行→coder、PWA実挙動＝pwa-verifier、UI実画面＝ui-auditor）。**例外は小改変のみ**（typo・docs微修・台帳・自明ワンライナー）。

  | 変更の種類 | 委任する役 | 起動 |
  |---|---|---|
  | 純粋ロジック（domain/application の判定・計算・状態遷移・変換で分岐/端ケースあり）＋バグ修正 | **test-author(Red)→coder(Green)** | 着手時 |
  | 自明な純粋関数・見た目/CSS・ブラウザAPI の薄い配線 | **coder**（テストごと） | 着手時 |
  | 教材データ（単語/英英/例文/グロスの追加・編集） | **content-author** | 着手時 |
  | UI/見た目/レイアウト/a11y が要点 | coder 実装 → **ui-auditor** 実画面監査 | マージ前 |
  | PWA/オフライン/SW/precache/install/OPFS の実挙動 | **pwa-verifier** 実ブラウザ検証 | 該当マージ前/本人指示 |
  | 層/依存の監査 | **ddd-auditor** | リリース直前/本人指示 |
  | 不具合調査（正しさ/挙動） | **bug-watcher** | リリース直前/本人指示 |
  | 大きめ/曖昧な UX・技術企画・契約(spec)起草 | **planner** | 着手前 |
  | 並列監査の合成・裁定／差分の品質レビュー | **reviewer** | fan-out 大の時 |
  | 台帳更新 | **各エージェントが自己更新**（司令塔は補完・全体監視） | 着手時・完了時 |

  **各行の詳細（その役に何をどこまで任せるか・役どうしの守備範囲の切り分け・並列運用）は `agent-routing` スキル**を読む。

## Issue 駆動開発
機能追加・修正・リファクタ・バグ修正など「作業」に適用（**typo・docs 微修・台帳更新・自明ワンライナーは除外**）。
- **着手前に GitHub Issue を書く**（無ければ作る＝本ルールで常設許可）。**チェック項目（`- [ ]`）は Issue 本文の先頭**に置く（コメントに置かない）。
- **コミットのたびにチェックを更新**し、**Issue に無い作業を入れたら本文に項目を追加**する。**develop マージ＋全項目完了で Close**（master の auto-close を待たない）。
- **詳細（適用の線引き・サブエージェントのコミット反映・Close の判断）は `issue-driven` スキル**。

## Git / PR ワークフロー
- ブランチ：`feature/*` → `develop` → `master`。**develop と master は乖離しうる**ので、新ブランチの起点と差分を毎回確認する。**マージ済みブランチはローカルも削除**する（→ `branch-cleanup` スキル）。
- `gh` は必ず **`env -u GITHUB_TOKEN gh ...`**（不正な `GITHUB_TOKEN` がキーチェーン認証を上書きするため）。
- **`Closes #N` は「feature→develop」と「develop→master」の両方のPR本文に書く**（auto-close は master 到達時のみ発火。develop止まりだと閉じない）。
- 何かを「完了」と言う前に **`npm run check`**（＝CI と同等。通れば CI も通る）。ただし**同じ差分に full `check` を多重に回さない**：反復・中間確認は **`check:fast`**、full `check` の権威ゲートは **push 前フック（`.githooks/pre-push`）＋CI に一任**する。
- リリースは **`npm run release -- <patch|minor|major>`**。原則は本人実行だが、**`/release` を本人が呼んだ場合は例外**（事前監査と自己点検が全てクリアなら AI がリリースまで実行してよい。異常があれば止めて報告）。
- **詳細（ブランチ削除の例外・`on-develop` ラベルの仕組み・docs のみPRの admin マージ・`shots:play`・リリースPRを `release/*` にする理由・GitHub Release の作り方）は `git-flow` スキル**。docs/DEVELOPMENT.md も参照。

## コミット
- メッセージは**簡潔な日本語・辞書形**、`Co-Authored-By` 等のトレーラーは付けない。
- **修正したら毎回コミットまで自分で行う**（コミット案の提示で止めない）。push/PR は上記のとおり指示があるときだけ。
- **AI（私・coder等）のコミットは `scripts/ai-commit.sh -m "…"` で打つ**（AI名義・**ローカル鍵署名で1Password非依存**・Verified付き。識別子はローカル `git config ai.*` から読むので個人情報を書かない）。初回設定・詳細は docs/DEVELOPMENT.md「Git コミット（AI署名）」。人間（本人）の `git commit` は従来どおり。

## コンテンツ規約（src/content）
- **コンテンツは単語を軸に結ぶ**（英英＝その単語の意味の英語説明、文章＝その単語を使った例文）。**英英は単語のサブセット**（`word` は words に在る語・`level`/`theme` も一致）。
- 足したら **`npm run validate`**（または `check`）で必ず検証。**大量追加は `npm run add-words <候補.tsv>`**。
- **詳細（レコードの形・読み(kana)の落とし穴＝長音「ー」/`づ`/特殊拗音・大量追加の手順・validate 赤の読み替え）は `content-rules` スキル**。docs/CONTENT.md も参照。

## アーキテクチャ（詳細は docs/ARCHITECTURE.md）
- **`.js` = ドメイン/データ、`.jsx` = UI**。依存は内向き（`ui → application → domain`、`application → infrastructure`）。
- 既存の層構成・命名を壊さない。`domain` は React/DOM 非依存。
- **ファイル名の接尾辞規約（`*.vo.js`/`*.service.js` 等）は `ddd-naming` スキル、契約テストが強制する規則は `ddd-contracts` スキル**。「この変更ならこのファイル」は `repo-map` スキル。

## 詳細ドキュメント
- 開発・スクリプト・CI・公開 … `docs/DEVELOPMENT.md`
- 設計・ディレクトリ … `docs/ARCHITECTURE.md`
- 教材データの追加・編集 … `docs/CONTENT.md`
