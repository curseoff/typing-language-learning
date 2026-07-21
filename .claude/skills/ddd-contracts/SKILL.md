---
name: ddd-contracts
description: DDD ステレオタイプ（VO/Entity/Aggregate/Factory/Event/Specification/Service/Repository/Policy/Store/Adapter/Mapper/Schema/Migration/Container/Presenter/Context）ごとに契約テストが何を強制するかの早見表。VO・サービス・ポリシー・リポジトリ・アダプタ等を新しく足すとき、既存の層に関数を追加するとき、`*.contract.test.js(x)` が赤くなったとき、新規モジュールを契約テストへ登録するときに読む。不変・決定性・非破壊・静的 grep の禁止トークンが対象。
---

# 契約テストが強制すること（ステレオタイプ別）

**契約テストは「そのステレオタイプらしさ」だけを見るメタテスト**。各モジュールが何を計算するかは当該 `*.test.js` の責務で、契約側に正解値は書かない。

- アサーションの実体＝**`src/test/contracts/<種別>.js`**（`assertValueObject` 等の再利用ヘルパ。`*.test.*` ではないので単体実行されない）
- 登録側＝**`*.contract.test.js(x)`**（対象を import して `describe(..., () => assertXxx({...}))` で載せる）
- ファイル名は `.contract.test.js` なので **命名メタテストの対象外**。命名規約は `ddd-naming` スキル、置き場所は `repo-map` スキル、赤の一般的な読み替えは `check-triage` スキル。

## 登録は「手動」が原則（例外は container だけ）

| | 挙動 |
|---|---|
| `src/ui/container.contract.test.jsx` | `src/ui` 配下の `*.container.jsx` を **fs で再帰列挙**＝新規 container は自動で契約対象（ラチェット） |
| それ以外すべて | **手動登録**。新しい VO/service/policy/adapter… を足しても自動では載らない。該当 `*.contract.test.js` に import と describe を追記する |

契約に載せられない対象は**黙って外さず、除外理由を冒頭コメントに明記**する（前例：`seed.policy.js`＝意図的に `Math.random`、`segTracker.policy.js` の `segMark/segMiss/segPush`＝引数破壊の accumulator、`db/sqliteWorker.adapter.js`＝node で import 不能、`TopFlow`/`Flow` presenter＝hooks 内包）。presenter 契約は除外分を「hooks を持つことを固定する it」で可視化する＝**甘い黙認にしない**のがこのリポジトリの流儀。

## ステレオタイプ別・強制される規則

| ステレオタイプ | 対象 / 登録先 | 強制される規則 | 典型的な赤 |
|---|---|---|---|
| **ValueObject** | `**/*.vo.js` → `domain/valueObject.contract.test.js` | **普遍層（常時）**：`make()` が `Object.freeze` 済み／別インスタンスは別参照だが**関数プロパティを除いた構造**が `toEqual`／`invalid` の各引数で `make` が throw。**任意層（`equals` を渡した時のみ）**：同値なら true・1 フィールド違えば false・`null` 相手は throw せず false | freeze 忘れ／不正引数を素通しして throw しない／`equals` が null で throw |
| **Entity** | `**/*.entity.js` → `domain/entity.contract.test.js` | **同一性(id)等価**：同 id なら他フィールドが違っても true、別 id なら false／`evolve`（可変メソッド or `with*`）後も同一性が保たれる／null 安全／id 欠落・空・不変条件違反で `make` が throw | `equals` を値等価で実装した（VO 契約と相互排他）／状態遷移で id が変わる |
| **Aggregate** | `**/*.aggregate.js` → `domain/aggregate.contract.test.js` | key の同一性等価（状態が変わっても同一）／`entries()` は**凍結スナップショット**で破壊操作しても内部へ波及しない／`submit` は**イミュータブル**（新ルートを返し元は不変）／満杯へ submit しても MAX を超えない／全既存より悪い record は採用されない | 内部配列をそのまま返す（外から push できる）／`submit` が自分を書き換える |
| **Factory** | `**/*.factory.js` → `domain/factory.contract.test.js` | ID は**外部注入の `nextId`** から供給（Date/乱数/内部 counter 禁止）＝連続生成で別 Entity・同じ注入器から作った 2 つの Factory は同一 id／不正な endCondition で `start` が throw／**非関数の注入器（`undefined`/`null`/数値/文字列/`{}`）で `createFactory` が throw** | Factory 内で id を自前生成した／注入器の型検査が無い |
| **DomainEvent** | `**/*.event.js` → `domain/domainEvent.contract.test.js` | 返り値が `Object.freeze`／`type` が **`/ed$/`（過去形）**／**キー集合が `['type', ...payload のキー]` と完全一致**＝時刻や id を内部生成して足さない・payload の値は同一参照で載る／同値 payload 同士は `toEqual`／必須情報欠落で throw | イベント内で `Date.now()` や uuid を付けた（キー集合不一致）／type が現在形 |
| **Specification** | `**/*.specification.js` → `domain/specification.contract.test.js` | `isSatisfiedBy` が truthy/falsy を**厳密 boolean に矯正**（`1`→true・`0`→false）／`and`/`or`/`not` が再び spec を返す（閉包）／真理値表と二重否定／合成しても**元 spec の真理値が変わらない** | 述語の戻り値を素通し（`1` が返って赤）／合成が生関数を返す |
| **DomainService** | `src/domain/**/*.service.js` の純関数 → `domain/domainService.contract.test.js` | **①決定性**（`sampleInput()` を毎回新規に作り 2 回の出力が `toEqual`）／**②非破壊**（呼び出し後も引数の観測像が不変）／**③外部乱数非依存**（`Math.random` の spy 呼び出し回数が 0） | 引数を `sort`/`push` で書き換えた／**下請けに `rng` を伝播し忘れて `Math.random` にフォールバック**（③だけ赤・①②は緑なので気づきにくい） |
| **Repository（ranking 系）** | domain Port ＋ `db/repos/*.repository.js` → `domain/repository.contract.test.js` / `db/repos/repository.contract.test.js` | C1 未保存キーの load は空／C2 save→load の round-trip／**C3 backing 分離**（別アダプタへ漏れない＝永続化無知）／R1 cap+4 件 save しても cap 件以下／R2 **独立比較器**で整列（repo の返り順を正解にしない）／R3 満杯後の最悪 record は採用されない | module スコープに backing を持って別インスタンスへ漏れる（C3）／上限・整列を担保し忘れる |
| **AccumulatorRepository** | 累積カウンタ系（`itemStats.repository.js`）→ 同上 | C1〜C3 に加え **A1 累積**：同一キーへ 2 件 save すると素の JS で合算した像（count=2・各値の総和）と `toEqual`。**上限/整列/押し出しは無い**（ranking 契約と別ヘルパ） | 上書き保存になっていて合算されない |
| **ApplicationService** | `src/application/**/*.service.js` のうち薄い調停 → `application/applicationService.contract.test.js` | **独自計算をしない**：出力の `record`/`key` が Domain を素に呼んだ独立オラクルと一致／**素通し**：`repository.submitRecord` の返り値を加工せず**同一参照**で返し、委譲値が 1 回だけ渡る／Domain Event を**指定順に** publish し payload が委譲値を運ぶ／**注入 stub だけで動く**（前回 deps を汚さない・repository 差し替えに出力が追随） | 整列・上限・採点を自前実装した／module グローバルを掴んで deps 差し替えが効かない |
| **Policy** | `src/application/**/*.policy.js` → `application/policy.contract.test.js` | **(A) per-fn** は DomainService と同一の 3 メタ性質（決定性・非破壊・`Math.random` 非依存）を `assertDomainService` に委譲／**(B) 環境非依存**：ソース文字列の**静的 grep**（下表）。実行では踏まない未到達枝の参照も禁じる | policy に `localStorage`/`window`/`Date.now()` を書いた（(B)）／accumulator 化して引数を破壊した（(A)） |
| **Store** | `src/application/**/*.store.js` → `application/store.contract.test.js` | 変更で通知し**同値の再変更では通知しない**（1 回だけ）／`unsubscribe` 後は通知されない／**参照安定**：未変更なら `getSnapshot()` が `toBe` 一致（`useSyncExternalStore` の無限ループ回避）／変更は snapshot に反映され変更後も安定。前提として `beforeEach` で reset | `getSnapshot` が毎回新しいオブジェクトを作る（実アプリでは無限再描画）／同値でも通知する |
| **Adapter** | `src/infrastructure/**/*.adapter.js` → `infrastructure/adapter.contract.test.js` | **Port 形状**：宣言した Port メソッドをすべて `function` で公開／**失敗の契約（縮退）**：**bare node（jsdom を付けない＝browser 不在＝失敗経路そのもの）**で同期 throw せず既定値へ return / resolve（subscribe 系は no-op の解除関数）。import 純度は「node 既定環境で import できる事実」で担保 | top-level で `window`/`AudioContext` に触れて import 時点で落ちる／browser 不在で reject する／jsdom を付けて縮退経路を踏まなくなる（テストが無意味化） |
| **Mapper** | `src/infrastructure/**/*.mapper.js` → `infrastructure/mapper.contract.test.js` | **往復不変** `fromRow(toColumns(x))` が元と `toEqual`／**決定的**／**非破壊**（`toColumns` が入力を書き換えない）。列名・JSON 表現は検証しない | 不在（`null`/`undefined`）の扱いが非対称で往復で値が増減する |
| **Schema** | `db/*.schema.js` → `db/schema.contract.test.js` | **薄いラッパ**：ソースに DDL 本体（`CREATE TABLE`/`ALTER TABLE`/`CREATE [UNIQUE] INDEX`）を**持たない**（静的 grep・定義は migration の責務）／**冪等**：空の in-memory sqlite へ apply すると期待テーブル群と最終 `user_version` が揃い、**再 apply しても不変**（forward-only） | ファサードに CREATE TABLE を直接書いた／再 apply で ALTER が再実行されて落ちる |
| **Migration** | `db/*.migration.js` → `db/migration.contract.test.js` | **DDL 宣言のみ**：業務ロジックのトークンを含まない（静的 grep・下表）／**冪等**：2 回 apply しても `sqlite_master` の像と `user_version` が同一（空適用でないことも確認＝vacuous 防止） | `up()` に `if` や DML を書いた／`IF NOT EXISTS` を省いて 2 回目で落ちる |
| **Container** | `src/ui/**/*.container.jsx`（**自動列挙**）→ `ui/container.contract.test.jsx` | **業務ロジック非漏出**の静的 grep のみ（`.sort(` / `.localeCompare` / `.reduce(` を持たない＝整列・集約・採点は domain/application へ委譲）。ふるまいは検証しない | 一覧を `.sort()` した・合計を `.reduce()` で畳んだ。**許容**＝`map`/`for` による presenter 用の 1 対 1 整形、表示密着の軽い算術（`Math.round`/`Math.min`） |
| **Presenter** | `src/ui/**/*.presenter.jsx`（薄板 shim）＋実体 `packages/ui/src/**/*.presenter.tsx` → `ui/presenter.contract.test.jsx`（jsdom） | **①純描画**（props から throw せず render できる）／**②決定性**（同じ props の再レンダで `innerHTML` 一致＝乱数・時刻非依存）／**③状態/副作用なし**：**実体 `.tsx` のソース**を grep して禁止フックを持たない。TS ジェネリクス呼び出し形（`useState<number>(0)`）も捕捉 | presenter に `useState`/`useEffect` を持ち込んだ。`useMemo`/`useCallback` は禁止パターンに**含まれない**が、持つ presenter は純プレゼンターではないので除外扱いにする |
| **Context** | `src/ui/**/*.context.jsx` → `ui/result/context.contract.test.jsx`（jsdom） | **供給**：Provider 配下で provide した値が**同一参照**で届く／**既定値**：Provider の外でも throw せず既定値（既定 `null`）を返す／**業務ロジック不在**（静的 grep）／**Context 実体**：ソースに `createContext` と `useContext` が現れる | `useState`/`useMemo` を持った・domain/application を import した／Provider 外で throw する（container がローカルへフォールバックできない） |

## 静的 grep の禁止トークン（該当層に書いたら赤）

**すべて `stripComments` 後に走査する**＝コメント内のトークンは誤検知しない（`http://` は URL とみなしコメント扱いしない）。文字列リテラル内は除去されない。

| 層 | 禁止パターン | 備考 |
|---|---|---|
| Policy | `document` `window` `localStorage` `sessionStorage` `navigator` `Math.random` `performance` `Date.now` `indexedDB` `new Date()`（引数なし） | **`Date` は全面禁止ではない**。`Date.parse(入力)` / `date.getTime()` は入力依存の純パースなので許容 |
| Migration | `insert` `update` `delete` `select`（大小無視）／`if (` `for (` `while (` `switch (`／`Math.` `Date.now` `new Date(`（引数ありも）／`random` | `date` という**列名は DDL に現れてよい**（禁止は `Date.now` と `new Date(` のみ） |
| Schema | `CREATE TABLE` `ALTER TABLE` `CREATE [UNIQUE] INDEX`（大小無視） | DDL は migration の責務 |
| Container | `.sort(` `.localeCompare` `.reduce(` | 整列は sortFn 注入か整列済み配列の受け渡し、集約は domain/application へ |
| Context | `useState` `useEffect` `useReducer` `useMemo` `useCallback` `useRef` `useSyncExternalStore`／`from '…/domain/'` `'…/application/'` `'…/infrastructure/'` | **加えて `createContext` と `useContext` の存在が必須** |
| Presenter | `useState` `useEffect` `useLayoutEffect` `useInsertionEffect` `useReducer` `useRef` `useContext` `useImperativeHandle` `useSyncExternalStore` `useTransition` `useDeferredValue` | `useMemo` / `useCallback` は**この正規表現に含まれない** |

## 新しく作るときの手順

1. `ddd-naming` の表どおりのサフィックスでファイルを作る（命名メタテストが先に赤くなる）。
2. 上表の規則を満たす形で実装する（凍結・自己検証 throw・引数非破壊・rng は注入）。
3. 該当 `*.contract.test.js` に import と `describe` を追記する（container 以外は自動で載らない）。
4. 載せられないなら**冒頭コメントに除外理由を書く**。契約側（禁止リストや assert）を緩めて通すのは最終手段で、司令塔に相談する。
