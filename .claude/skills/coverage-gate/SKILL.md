---
name: coverage-gate
description: カバレッジ閾値の在り処と、割れたときの直し方。`check` が coverage で赤い、閾値を上げたい／下げたい、未カバー行を特定したいときに読む。閾値の実数値・include/exclude の方針・up-only ラチェットの作法を引く。
---

# カバレッジ閾値（coverage gate）

## 閾値はどこにあるか

**`vite.config.js` の `test.coverage.thresholds`（1ファイルだけ）**。`vitest.config.*` は存在せず、vitest の設定は `vite.config.js` の `test` に同居している。

```js
thresholds: { statements: 89.75, branches: 84.0, functions: 90.75, lines: 90.95 }
```

- **global 閾値のみ**。per-file / per-directory（`thresholds['src/**']` 形式）や `100: true` は使っていない。つまり**リポジトリ全体の合計**でしか判定されない＝「1ファイルが 0% でも全体が閾値を超えていれば緑」。
- provider は **v8**、reporter は **`['text-summary', 'html']`**。
- 閾値の直上に **`#233` 以降のラチェット履歴がコメントで積まれている**。数値を動かすときはこの列に1件追記するのが慣例（何をテストして何%になったから幾つへ、を書く）。

直近の実測（`npm run coverage`、2026-07 時点・master 相当）:

| 指標 | 実測 | 閾値 | 余裕 |
|---|---|---|---|
| Statements | 89.96% (4867/5410) | 89.75 | +0.21 |
| Branches | 84.19% (3756/4461) | 84.0 | +0.19 |
| Functions | 90.81% (1186/1306) | 90.75 | +0.06 |
| Lines | 91.17% (4070/4464) | 90.95 | +0.22 |

**余裕は 0.06〜0.22 しかない**。v8 の計測は実行ごとに ±0.1 程度揺れるので、新規ファイルを1つ足しただけでも割れうる。特に **functions は常にギリギリ**。

## 何が分母に入っているか（include / exclude）

```js
include: ['src/**/*.{js,jsx}', 'packages/*/src/**/*.{ts,tsx}']
```

`packages/*/src`（`@tll/ui` の presenter）も計測対象。ワークスペース側を触ったら src と同じ分母に効く。

`exclude` の系統は3つ。**下がった原因を読むときはまずこの分類に当てはめる**。

1. **テスト・データ・エントリ** — `src/**/*.test.{js,jsx}` / `src/content/**`（生成物）/ `src/test/**` / `src/main.jsx` / `packages/*/src/index.ts`（barrel）/ `*.d.ts` / `*.stories.tsx`。
2. **ブラウザ API の薄い配線**（jsdom/node で意味のある計測ができないもの）。`registerSW.adapter.js`、`infrastructure/db/*`（sqliteWorker/initStorage/migrations）、`persist/multiTab.adapter.js`・`persistentStorage.adapter.js`・`externalBackupStore.adapter.js`、`p2p/webrtcPeer.adapter.js`、`application/versus/useVersus.js`・`externalBackup.service.js`。
3. **上記に紐づく UI 配線** — `ui/ready/DataBackupBar.jsx`、`ui/pwa/PersistNotice.jsx`・`usePersistNotice.js`、`ui/versus/VersusConnect.container.jsx`・`VersusMatch.container.jsx`・`VersusLobby.container.jsx`。

**除外行には必ず「なぜ計測できないか＋純ロジックはどこで被覆しているか」のコメントが付いている**（前例多数）。この様式を崩さない。逆に言えば、**純ロジックを除外に足すのは規約違反**。`runMigrations.js` が「純ロジックなので除外しない」と明記されているのが基準線。

## 走らせ方とレポート

- 単体で回す: **`npm run coverage`**（＝`vitest run --coverage`。`precoverage` で `content-build.mjs` が走り `src/content/*Data.js` を再生成する）。所要 **25〜30秒**程度。
- `npm run check` では **`lint` の次**（2番目）に走る。`check:fast` には**入っていない**（代わりに `test` が走る＝テストは全数通るが閾値ゲートは掛からない）。
- CI（`.github/workflows/ci.yml`）では **build の後**に `npm run coverage` として走る（順番がローカルの `check` と違う）。

### 未カバー行の特定

reporter に **`text`（ファイル別の表）が入っていない**ので、コンソールには合計しか出ない。行を特定するには次のどちらか。

```bash
# 1) HTML レポート（既定の出力先＝リポジトリ直下 coverage/、gitignore 済み）
npm run coverage && open coverage/index.html      # src/ と packages/ をドリルダウン、赤=未実行行

# 2) ファイル別のテキスト表をその場で出す（設定は変えずに CLI で上書き）
npx vitest run --coverage --coverage.reporter=text
```

**注意：テストファイルを絞って `npx vitest run --coverage src/foo.test.js` と回すと、走らなかった他ファイルが 0% 扱いになり合計が壊れる**（閾値も当然割れる）。閾値の実測を見る目的では**必ず全数**で回す。特定ファイルだけ見たいなら `--coverage.include='src/domain/**'` で分母ごと絞る。

## 赤くなったときの判断

`ERROR: Coverage for <指標> does not meet global threshold` が出たら、**まず「どの指標が」「何%足りないか」を見る**。

| パターン | 見分け方 | 取るべき手 |
|---|---|---|
| 新規ファイルを足したがテストが無い | 4指標が揃って下がる。HTML で新規ファイルが 0% | **テストを足す**（第一手）。domain/application のロジックなら TDD の流儀どおり test-author の Red が先にあるはず |
| **branches だけ**落ちている | statements/lines は据え置きで branches のみ下振れ | **端ケースのテストが無い**。早期 return・`??`/`?.`・デフォルト引数・三項が未通過。HTML の黄色 `E`/`I` マーク（else/if path not taken）を潰す |
| functions だけ落ちている | 定義しただけで一度も呼ばれない関数（コールバック・ハンドラ） | ハンドラは**発火させて**通す（`renderHook` + `dispatchEvent` を `act()` で。既存 `src/application/use*.test.js` が手本） |
| 計測すべきでないものが分母に入った | 設定・barrel・型宣言・**ブラウザ API の薄い配線**が 0% で並ぶ | **`exclude` を直す**。ただし上の「除外の3系統」に当てはまるものだけ。理由＋純ロジックの被覆先をコメントで書く |
| 実測は上がったのに確率的に割れる | 同じ差分で緑/赤が揺れる | 閾値が実測直下すぎる。**0.2〜0.3 のマージン**を取り 0.1 単位で切り捨てる |

**判断の優先順位は「テストを足す ＞ exclude を直す ＞ 閾値を下げる」**。

### 閾値を動かすときの作法（up-only ラチェット）

- **上げる**：テストを足して実測が上がったら、**実測から 0.2〜0.3 引いて 0.1 単位で切り捨てた値**へ上げる。`vite.config.js` の履歴コメントに1行追記（Issue 番号＋何を被覆したか＋実測値）。これは AI が自分で判断してよい。
- **下げる**：**原則やらない＝最終手段**。テストで埋める・exclude を正す、のどちらでも解けないと確認できて初めて選択肢に上がる。**下げるのは本人（ユーザー）の判断が要る**ので、AI は下げずに「実測 X、閾値 Y、埋められない理由」を添えて本人へ上げる。
- 閾値を触った／実測が要るときは、`check:fast` ではなく **full `npm run check` を1回**回して実測を確認する（→ `check-triage`）。

## 関連

- 失敗ログ全般の読み替え（lint/validate/build/check-bundle/契約テスト）→ **`check-triage`**
- `check` と `check:fast` の使い分け・push 前フックの権威ゲート → **`check-triage` / `git-flow`**
- 除外に足すか迷う「層としてどこか」の判断 → **`ddd-naming` / `repo-map`**
