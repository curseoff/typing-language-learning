# Claude 向け作業ガイド

このリポジトリで作業するときの規約。README/docs/コードから分かることは繰り返さない（毎セッション読まれるため簡潔に）。

## 応答・進め方
- **日本語で応答**する。
- **`git push` と PR 作成は、本人の明示指示があるときだけ**行う（指示が無ければやらない。完了後に push 用コマンドを案内するのは可）。その他の破壊的・外部公開（Issue/デプロイ等）も、まとめて委任されていなければ確認してから行う。
- **push の前に必ず自己点検**：未push差分（`origin/<branch>..<branch>`）に**公開して問題があるもの**（秘密情報＝APIキー/トークン/パスワード/秘密鍵・`.env`/鍵ファイル、氏名/メール等の個人情報の直書き、絶対パスでの username 露出 など）が無いか AI が判断し、**状況を本人に報告**してから push 指示を仰ぐ。リポジトリは PUBLIC。個人情報の実値はドキュメントに直書きせずプレースホルダにする。
- ユーザーの対応が必要で離席の可能性がある時は通知（PushNotification）。
- **エージェント体制**：司令塔（メイン）＋サブエージェント（`.claude/agents/`：coder＝実装(Green)／test-author＝テスト先行(Red)／ddd-auditor＝層/依存監査・ui-auditor＝見た目/a11y実画面監査（read-only）／reviewer＝並列監査の合成・裁定＋差分の品質(再利用/簡素化)レビュー（read-only）／planner＝UX/技術企画・Issue草案＋契約(spec)先回り起草／bug-watcher＝正しさ/挙動の不具合調査（リリース直前 or 本人指示）／content-author＝教材オーサリング（単語/英英/例文/グロスの追加・編集）／pwa-verifier＝PWA/オフライン実挙動の実ブラウザ検証（read-only）／ledger-keeper＝稼働台帳の管理・監視）。実装は coder に委任し、監査役で確認、push/PR/Issue作成/着手の判断は**本人**が行う（**例外：bug-watcher は本人の常設許可で `bug` 不具合 Issue の作成・更新・クローズを自律実行してよい**。確証のある不具合のみ）。**台帳更新は `ledger-keeper` に委任する**：エージェントを委任するたびに、**①起動した時と②その処理が完了した時の2回**、`ledger-keeper` に依頼して `tmp/agent-status.tsv`（稼働台帳・ローカルのみ／gitignore）を更新・稼働監視させる（ledger-keeper が `npm run team:set` で記録し、停滞・失敗・要判断の滞留など機能不全に注意して報告する）。観測しやすいよう長めのタスクは `run_in_background:true` で起動する。本人は **`npm run team`**（即時に見たいなら `! npm run team`）で各エージェントの稼働状況を確認できる。
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
  | 台帳更新・稼働監視 | **ledger-keeper** | 各委任の起動時・完了時 |

  各行の詳細：
  - **純粋ロジック**（domain/application の判定・計算・状態遷移・変換で**分岐/端ケースあり**）＋**バグ修正** → **test-author が Red(commit) → coder が Green**。**「UI 寄り」に分類する前に、純粋ロジックが混ざっていないか必ず確認**し、混ざれば切り出して test-author を通す（判断基準：**「そのテストは実装をなぞるだけ＝同義反復になりそうか」→ なりそうなら test-author 先行**で独立性を確保。速度を理由に省かない）。
  - **自明な純粋関数**（`!muted` 等・分岐/端ケースなし）・**見た目/CSS/ブラウザAPIの薄い配線**（AudioContext/SW/navigator/localStorage） → coder がテストごと。
  - **教材データ**（単語/英英/例文/グロスの追加・編集） → **content-author**（候補生成→読み生成→重複/読み点検→`validate`/`check` 緑まで一貫。正準ソースは `content/*.ndjson`＝生成物 `src/content/*Data.js` は触らない。数千語規模は役割別サブエージェントを並列運用）。**TDD 対象外**（`validate`/`check`/読み点検で担保）。データ構造を扱う domain/application のロジック変更が混ざるなら切り出して test-author→coder に回す。
  - **UI/見た目/レイアウト/a11y が要点**の変更 → マージ前に **ui-auditor が実画面で独立確認**（司令塔は最終判定のみ・headless 自己検証を抱え込まない）。`shots:play` で捉えられない状態（打鍵途中等）は ui-auditor が **puppeteer 等で状態を作って検証**する。
  - **PWA/オフライン/Service Worker/precache/インストール導線/OPFS 永続化の実挙動** → **pwa-verifier が実ブラウザ（puppeteer + システム Chrome）で検証**（read-only）。`setOfflineMode`・SW 更新・`beforeinstallprompt`・precache 命中・OPFS 読み書きなど「状態を作らないと見えない PWA 挙動」を担当。**見た目の崩れは ui-auditor** と守備範囲を分ける（PWA の見た目は ui-auditor、動く/落ちる/オフライン成立は pwa-verifier）。起動は該当変更のマージ前 or 本人指示。
  - **層/依存の監査（ddd-auditor）** → **リリース（develop→master）の直前に bug-watcher と同枠で司令塔が起動**し、未リリース分（`origin/master..origin/develop`）の依存方向・責務漏れ・domain 純粋性を独立監査。または**本人指示**でも起動。**毎コミット/毎マージ/構造変更ごとには起動しない**（bug-watcher と同じトリガ）。
  - **大きめ/曖昧な UX・技術企画**、および**契約(spec)の先回り起草**（並列開発のキュー埋め＝純粋ロジックの入力→出力・シグネチャ・端ケースを実装前に言語化） → **planner**（草案/契約を司令塔に返す。着手前 Issue は原則司令塔＝Issue駆動。契約は司令塔が test-author→coder へ渡す前段。重要ロジックは本人承認を挟む）。
  - **並列監査の合成・裁定／差分の品質レビュー（再利用・簡素化・効率）** → **reviewer**（read-only。複数監査の重複排除・敵対的検証で採否とリリース可否を判定。fan-out が大きい時に使う。小規模は司令塔が兼ねてよい）。
  - **不具合調査（正しさ/挙動）** → 本人指示 or リリース直前（上記 bug-watcher ルール）。**見た目は ui-auditor／層・依存は ddd-auditor** と守備範囲を分ける（重複させない）。
  - **並列運用**：独立タスクは worktree 隔離で並列可（1ファイル1ライター・read-only 監査は自由並列・マージは直列キュー）。fan-out を本格化する場合は Workflow を検討（本人がオプトイン）。

## Issue 駆動開発（実質的な開発に適用）
機能追加・修正・リファクタ・バグ修正など「作業」に適用。**typo・docs 微修・`tmp/agent-status.tsv` 台帳更新・自明なワンライナー等の小改変は除外**。
- **着手前に GitHub Issue を書く**（無ければ作る）。目的と、**進捗を管理するチェック項目（`- [ ]`）** を作業単位に分解して用意する。着手前の Issue 作成は本ルールで常設許可（※通常の「Issue 作成は本人判断」より優先）。
- **チェックリストは Issue 本文（先頭）に置く**（コメントに置かない）。本文で一元管理すると先頭で常に可視・編集が1箇所・auto-close とも相性が良い。既存 Issue（bug-watcher 起票分など）で本文にチェックリストが無ければ、**本文を編集して追加**する。コメントは方針変更・経緯・補足の記録に使い、進捗チェックの正本は本文に一本化する。
- **コミットのたびに、対応する Issue のチェックを更新**する（完了項目を `- [x]` に）。coder 等サブエージェントのコミットが着地したら**司令塔が反映**する（各コミットが Issue のどの項目かを対応づける）。
- **コミットで Issue に無い作業を入れたら、Issue にその旨を追記**する（**本文のチェックリストに項目を追加**。経緯はコメントで補足可）。Issue と実装の乖離を残さない。
- **develop にマージされ、全チェック項目が完了したら Issue を Close** する（master 到達時の auto-close を待たない）。feature コミット単体（develop 未マージ）では閉じない＝早すぎる Close を避ける。
- feature→develop / develop→master の PR 本文は従来どおり `Closes #N`（保険：master 到達での auto-close 用）。

## Git / PR ワークフロー
- ブランチ：`feature/*` → `develop` → `master`。**develop と master は乖離しうる**ので、新ブランチの起点と差分を毎回確認する。
  - **マージ済みブランチは消す**：PR が develop（または master）にマージされたら、**リモートは GitHub の auto-delete で自動削除**される。**ローカルブランチも `git branch -D` で削除**し、`git fetch origin --prune` で追跡を掃除すること。例外として `issue-assets`（画像ホスティング・PRマージしない）と保留中の `feature/srs-review`(#85) は残す。
- `gh` は必ず **`env -u GITHUB_TOKEN gh ...`**（不正な `GITHUB_TOKEN` 環境変数がキーチェーン認証を上書きするため）。
- **`Closes #N` は「feature→develop」と「develop→master」の両方のPR本文に書く**。自動クローズは **master（デフォルトブランチ）到達時のみ**発火する。develop止まりだと閉じない。
  - develop マージ時には **`on-develop` ラベルが自動付与**される（`.github/workflows/label-on-develop.yml` が PR の Closes/Fixes/Resolves #N を検出）＝「develop に乗った（リリース待ち）」の目印。master 到達で auto-close。だから feature→develop PR にも必ず `Closes #N` を書くこと。
- 何かを「完了」と言う前に必ず **`npm run check`**（lint→**coverage**→validate→build→check-bundle→audit ＝ **CI と同等**）を通す。**`check` が通れば CI も通る**。素早く回したい時は `npm run check:fast`（coverage の代わりに test）。
- **push 前フック**（`.githooks/pre-push`）が `check` を強制（CI赤の混入防止）。急ぐ時のみ `git push --no-verify`。**master/develop はブランチ保護で CI 緑必須**（赤ではマージ不可）。
- UI目視は **`npm run shots:play`**（dev 相手に `?preview=result|play|story` を撮影＝プレイ中/結果/記録を手動プレイ無しで確認）。リリースは **`npm run release -- <patch|minor|major>`**（自己点検→版上げ→check→PR→マージ→Release→デプロイ）。原則は本人実行だが、**`/release` コマンドを本人が呼んだ場合は例外**で、事前監査（bug-watcher/ddd-auditor）と自己点検が全てクリアなら AI がそのままリリースまで実行してよい（`/release` の呼び出し自体が明示指示）。異常があれば止めて報告する。
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
