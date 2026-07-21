---
name: check-triage
description: `npm run check` / `check:fast` / CI が赤いときの症状→原因→対処の読み替え表。失敗ログの意味が分からないとき、check と check:fast のどちらを回すべきか迷ったときに読む。
---

# check が赤いときの読み替え

## 何がどの順で走るか

| コマンド | 中身（左から順に実行・最初の失敗で止まる） |
|---|---|
| `check` | `lint` → `coverage` → `validate` → `build:pkgs` → `build` → `check:content` → `check-bundle` → `audit` |
| `check:fast` | `lint` → `test` → `validate` → `build:pkgs` → `build` → `check-bundle` |

`check:fast` に無いのは **coverage 閾値・check:content・audit** の3つだけ（テストは `test` で全数走る）。

`pre*` フックが暗黙に走る：`prevalidate`/`pretest`/`precoverage` → `content-build.mjs`、`prebuild`/`predev` → `content-build` + `content-sqlite` + `gen-miss-sound`、`postbuild` → `gen-404` + `gen-precache`。**`src/content/*Data.js` は毎回この生成で上書きされる**（正準ソースは `content/*.ndjson`）。

CI（`.github/workflows/ci.yml`）は check を個別ステップに展開しているが、**順番が違い（coverage が build の後）、`build:pkgs` が無い**。ローカル緑／CI 赤のときはまずここを疑う。`check:ci` は Linux/node20 コンテナで `npm ci && npm run check` を再現する。

## 症状 → 原因 → 見る場所 → 直し方

| 症状 | 原因 | 見る場所 | 直し方 |
|---|---|---|---|
| `lint` で `tmp/` 配下の scratch が落ちる | `eslint.config.js` の `ignores` に **`tmp` が無い**（gitignore は ESLint flat config に効かない） | `eslint.config.js` の `ignores` | scratch は `/private/tmp/...` のスクラッチ領域へ。リポジトリ直下 `tmp/` に `.js` を置かない。**warning は落ちない・error だけ落ちる** |
| `lint` が生成物で落ちる | 生成された `src/content/*` は個別に ignore 済み。追加した生成物は未登録 | `eslint.config.js` の `ignores` 末尾 | 生成物なら ignore に追記（手書きコードは直す） |
| `coverage` で `ERROR: Coverage for X does not meet threshold` / 閾値を上げ下げしたい / 未カバー行を特定したい | 閾値割れ（閾値は **`vite.config.js` の `test.coverage.thresholds`**） | → **`coverage-gate` スキル**（実数値・include/exclude の方針・HTML レポートの見方・up-only ラチェットの作法・指標別の対処） | **原則テストを足して埋める。閾値の引き下げは最終手段＋本人判断** |
| `validate` が赤 | 教材データの不整合。2本走る：`validate-sentences.mjs`（生成物に対する意味検証＝dict⊆words・jaWords 連結=ja・kana 打鍵可・英文/和文の句読点対応）と `content-validate.mjs`（`content/*.ndjson` の構造・型・`en` 一意・`level = bandOf(freq)`） | エラー文が `content/xxx.ndjson 行N: …` 形式で出る | **`content/*.ndjson` を直す**（`src/content/*Data.js` は生成物なので触らない）。読み（kana）の赤は長音「ー」・`づ`/`ぢ`・特殊拗音を疑う |
| `build` が赤 | import 解決・構文・`prebuild` の content 生成失敗 | まず `prebuild` 側（`content-build.mjs` / `content-sqlite.mjs`）が落ちていないか確認 | prebuild の赤なら実体は validate 相当のデータ問題 |
| `check-bundle` で予算超過 | 初回エントリ `dist/assets/index-*.js` が肥大 | `scripts/check-bundle.mjs`。**予算 512 KB／実測 410.0 KB**（`BUNDLE_BUDGET_KB` で上書き可） | 予算を上げずに**遅延 import 化**する（`src/content/wordSentences/index.js` が手本）。静的 import に戻した教材が原因のことが多い |
| `check:content` が赤 | `dist/assets/content-<hash>.sqlite3` が無い／複数／SQLite ヘッダ不正 | `scripts/check-content-sqlite.mjs` | 先に `npm run build`。dist が古いだけのことが多い |
| `audit` が赤 | **prod 依存**に high 以上の脆弱性（`npm audit --omit=dev --audit-level=high`） | `npm audit --omit=dev` の出力 | dev 依存は対象外。prod 依存なら更新。判断が要るなら本人へ上げる |
| `src/domain/_ddd-naming.test.js` が `expected [ 'src/…/foo.js' ] to equal []` | **DDD ステレオタイプ命名メタテスト**。層ごとに許可サフィックスが違う | `src/domain/_ddd-naming.test.js` の `TREES` | ファイル名を許可サフィックスへリネーム。domain/core=`entity/aggregate/vo/factory/event/specification/repository/service`、infrastructure=`repository/adapter/migration/schema/mapper`、application=`service/policy/store`、`src/ui`(.jsx)=`container/presenter/context`、`packages/ui/src`=`.presenter.tsx`/`.util.ts`。除外は `*.test.*`・`*.d.ts`・`index.js|ts`、application/ui の `use*` |
| `*.contract.test.js` が赤 | 層ごとの**共通契約メタテスト**（VO の凍結/値等価、DomainService の決定性・非破壊・乱数非依存、Repository/Store/Policy 等）。個別の計算値は検証していない | `src/test/contracts/<種別>.js` のヘルパ本文＋当該 `*.contract.test.js` の登録リスト | 契約違反が本物（例：VO を `Object.freeze` していない、service が引数を破壊、`Math.random` 直呼び）。**契約側を緩めず実装を直す**。新規モジュールを足したら契約テストの import 一覧にも追加する |

## `check` と `check:fast` の使い分け

- 反復中・委任先の自己確認・司令塔の中間確認は **`check:fast`**。
- **full `check` の権威ゲートは push 前フック（`.githooks/pre-push`）と CI に一任**する。差分が変わっていないのに手で full `check` を回さない。
- full `check` を明示的に回すのは、**カバレッジ閾値を触ったとき／実測値が要るとき**だけ。
- `.githooks/pre-push` は **`*.md` と `docs/` だけの差分なら check をスキップ**する。急ぐときのみ `git push --no-verify`。
