---
name: agent-routing
description: 変更をどのサブエージェントへ委任するかの詳細規約。委任先の判断に迷ったとき、役どうしの守備範囲が重なって見えるとき、並列運用（worktree 隔離）を検討するときに読む。各役の守備範囲・起動タイミング・境界の切り分けを引く。
---

# 委任先の判断（詳細）

**役の選択そのものは CLAUDE.md の「役割の受け渡し」表で行う**（表は常駐＝ここを読まなくても役は選べる）。このスキルは、選んだ後の「その役に何をどこまで任せるか」「境界が重なって見えるときどちらか」を確定させるためのもの。

## サブエージェント一覧（`.claude/agents/`）

| 役 | 担当 | 特性 |
|---|---|---|
| `coder` | 実装（Green） | ファイルを編集する |
| `test-author` | テスト先行（Red） | 本体コードは書かない |
| `content-author` | 教材オーサリング（単語/英英/例文/グロス） | ファイルを編集する |
| `ddd-auditor` | 層/依存の監査 | read-only |
| `ui-auditor` | 見た目/a11y の実画面監査 | read-only |
| `pwa-verifier` | PWA/オフライン実挙動の実ブラウザ検証 | read-only |
| `bug-watcher` | 正しさ/挙動の不具合調査 | read-only ＋ Issue 操作 |
| `reviewer` | 並列監査の合成・裁定／差分の品質レビュー | read-only |
| `planner` | UX/技術企画・Issue 草案・契約(spec)起草 | 実装しない |

**判断の所在**：実装は coder に委任し、監査役で確認する。**push / PR / Issue作成 / 着手の判断は本人**が行う。

**例外**：bug-watcher は本人の常設許可で、`bug` ラベルの不具合 Issue の作成・更新・クローズを自律実行してよい（**確証のある不具合のみ**）。

## 各役の詳細

### 純粋ロジック＋バグ修正 → test-author(Red) → coder(Green)
domain/application の判定・計算・状態遷移・変換で**分岐/端ケースあり**のもの、および**バグ修正**。

**「UI 寄り」に分類する前に、純粋ロジックが混ざっていないか必ず確認**し、混ざれば切り出して test-author を通す。

判断基準：**「そのテストは実装をなぞるだけ＝同義反復になりそうか」→ なりそうなら test-author 先行**で独立性を確保する。**速度を理由に省かない。**

### 自明な純粋関数・薄い配線 → coder（テストごと）
`!muted` 等・分岐/端ケースなしの純粋関数。見た目/CSS。ブラウザAPIの薄い配線（AudioContext / SW / navigator / localStorage）。

### 教材データ → content-author
単語/英英/例文/グロスの追加・編集。候補生成→読み生成→重複/読み点検→`validate`/`check` 緑まで一貫して任せる。

- 正準ソースは `content/*.ndjson`。**生成物 `src/content/*Data.js` は触らない。**
- 数千語規模は役割別サブエージェントを並列運用。
- **TDD 対象外**（`validate`/`check`/読み点検で担保）。
- データ構造を扱う domain/application の**ロジック変更が混ざるなら切り出して** test-author→coder に回す。

### UI/見た目/レイアウト/a11y → coder 実装 → ui-auditor（マージ前）
ui-auditor が**実画面で独立確認**する。司令塔は最終判定のみで、**headless 自己検証を抱え込まない**。

`shots:play` で捉えられない状態（打鍵途中等）は、ui-auditor が **puppeteer 等で状態を作って検証**する。

### PWA/オフライン実挙動 → pwa-verifier
Service Worker / precache / インストール導線 / OPFS 永続化など、**状態を作らないと見えない PWA 挙動**を実ブラウザ（puppeteer + システム Chrome）で検証する。`setOfflineMode`・SW 更新・`beforeinstallprompt`・precache 命中・OPFS 読み書きなど。

**ui-auditor との境界**：PWA の**見た目の崩れは ui-auditor**、**動く/落ちる/オフライン成立は pwa-verifier**。

起動は該当変更のマージ前 or 本人指示。

### 層/依存の監査 → ddd-auditor
**リリース（develop→master）の直前に bug-watcher と同枠で司令塔が起動**し、未リリース分（`origin/master..origin/develop`）の依存方向・責務漏れ・domain 純粋性を独立監査する。または**本人指示**でも起動。

**毎コミット/毎マージ/構造変更ごとには起動しない**（bug-watcher と同じトリガ）。

### 不具合調査 → bug-watcher
本人指示 or リリース直前。**見た目は ui-auditor ／ 層・依存は ddd-auditor** と守備範囲を分ける（重複させない）。

### 企画・契約起草 → planner
大きめ/曖昧な UX・技術企画。および**契約(spec)の先回り起草**（並列開発のキュー埋め＝純粋ロジックの入力→出力・シグネチャ・端ケースを実装前に言語化）。

草案/契約を司令塔に返す。着手前 Issue は原則司令塔＝Issue 駆動。契約は司令塔が test-author→coder へ渡す前段。**重要ロジックは本人承認を挟む。**

### 監査の合成・品質レビュー → reviewer
read-only。複数監査の重複排除・敵対的検証で採否とリリース可否を判定する。**fan-out が大きい時に使う**（小規模は司令塔が兼ねてよい）。

## 中間ホップと並列運用

中間ホップは司令塔が逐次オーケストレーションする（成果物＝ブランチを介して各役へ渡す）。

独立タスクは **worktree 隔離で並列可**：

- 1ファイル1ライター
- read-only 監査は自由並列
- マージは直列キュー

fan-out を本格化する場合は Workflow を検討（本人がオプトイン）。

## 稼働台帳（`tmp/agent-status.tsv`・ローカルのみ／gitignore）

**各エージェントが自己更新する**（司令塔は起動/完了の2回代行をしない）：

- 委任された役は**着手時（最初のアクション）に自分の行を「実行中」**へ
- **完了時（報告直前の最後のアクション）に「完了／要判断／要対応」**へ

いずれも `npm run team:set` で upsert する。

司令塔の担当は、自分の `commander` 行の更新、委任先が打ち損ねた時の補完、および全体監視（`npm run team` で停滞・失敗・空結果・要判断の滞留を点検）。専任の ledger-keeper は廃止済み。

観測しやすいよう**長めのタスクは `run_in_background:true` で起動**する。本人は `npm run team`（即時に見たいなら `! npm run team`）で稼働状況を確認できる。
