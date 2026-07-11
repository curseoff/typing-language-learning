# DDD 学習ノート（#290 Phase 0：戦略フレーミング）

学習目的で DDD をこのコードベースへ段階導入する記録。ロードマップは #290。本ページは **Phase 0 = 戦略フレーミング**：
以降の戦術（VO→集約→Repository…）に文脈を与えるため、**ユビキタス言語（共通言語）**を辞書化し、**文脈候補（Bounded Context 候補）**と**Context Map**を素描する。コード変更は無し（概念整理）。

> なぜ最初に戦略か：戦術パターンを文脈なしで入れると「集約スープ」になりやすい。まず「どんな概念が・どの境界にあるか」を言葉にしてから戦術に降りる。

---

## 1. ユビキタス言語（Ubiquitous Language）辞書

コード・docs・コメント・会話で**同じ語**を使うための辞書。現行コードで既に使われている語を正典化する（`file` は代表的な定義元）。

### 記録・ランキング（Records）
| 用語 | 意味 | 代表 |
|---|---|---|
| **記録（record）** | 1回の完走結果（速度・正確率・時間・ミス・打鍵数・日時など）。 | `domain/records/ranking.js` |
| **ランキング（ranking / rankInsert）** | 記録を「速い順（4択は正解数順）」で最大 `MAX_RECORDS`(=15) 件保持する並び。 | `ranking.js: rankInsert / MAX_RECORDS` |
| **記録キー（recKey / *RecKey）** | どのランキングかを識別するキー。種類×レベル×テーマ×モード×終了条件で決まる。 | `ranking.js: recKey`, `records/recordKeys.js: wordRecKey/dictRecKey/storyRecKey` |
| **item id / 収録統計（item_stats）** | 問題ごとの累積統計（練習回数・平均ミス・打/秒）の識別子 `type:mode:key`。 | `recordKeys.js: itemId` |
| **記録可否（isRecordable）** | その終了条件・モードが記録対象か（例：タッチタイピングは非記録）。 | `ranking.js: isRecordable` |
| **比較（compareRecords）** | 終了条件ごとの「良い記録」の順序規則。 | `ranking.js: compareRecords` |

### 終了条件（EndCondition）
| 用語 | 意味 | 代表 |
|---|---|---|
| **終了条件（endCondition）** | プレイの終わり方。`{kind, value}`（kind＝time/chars/endless、value＝60秒 等）。 | `domain/session/endCondition.js` |
| **終了判定（shouldFinish）** | 現在の進捗が終了条件を満たしたか。 | `endCondition.js: shouldFinish` |
| **進捗率（progressRatio）／制限（endLimitMs）** | 進捗の割合／時間制の上限 ms。 | `endCondition.js` |
| **終了条件タグ（endConditionTag）** | 記録キーに載せる終了条件の短縮表記（time60 等）。 | `ranking.js: endConditionTag` |

### 出題（Play / 教材の展開）
| 用語 | 意味 | 代表 |
|---|---|---|
| **問題列（passage / set / drill）** | プレイで出す問題の並び。文章＝passage、単語/英英＝set、タッチ/ローマ字＝drill。 | `marathon/passage.js: buildPassage`, `words/wordset.js: buildWordSet`, `touch/drill.js: buildDrill` |
| **4択（quiz / pick）** | 選択式の出題（単語4択・英英4択・説明4択）。 | `words/wordset.js: makeQuiz`, `dictionary/dictset.js: makeDictQuiz/makeDictPick` |
| **モード（mode）** | 出題/入力の様式（en/ja/both/quiz 等）。 | `content/modes.js` |
| **採点（score）** | 打鍵・ミス・時間から速度/正確率を出す。 | `marathon/scoring.js: score` |

### ローマ字・タイピング（Typing engine）
| 用語 | 意味 | 代表 |
|---|---|---|
| **かな⇄ローマ字（toRomaji / romajiVariants / kanaConsumed）** | 読み（かな）と許容ローマ字綴りの相互変換（shi/si を同時許容）。 | `@tll/core: romaji/romaji.js` |
| **かな表（KANA_TABLE / kanaOf / cellOf）** | ヘボン式かな配列（不変値）。 | `@tll/core: romaji/kanaTable.js` |
| **受理判定（acceptsRomaji / isKanaComplete）** | 入力が現在かなの綴りとして正しいか／打ち切ったか。 | `domain/romaji/input.js` |
| **進捗変換（progress / alignJaToKana）** | 打鍵済みプレフィックスを漢字位置へ変換して着色。 | `domain/typing/progress.js` |

### 永続化（Persistence）
| 用語 | 意味 | 代表 |
|---|---|---|
| **バックエンド（backend）** | 記録の保存方式。`sqlite`（OPFS の SQLite・既定）／`memory`（非対応環境＝非永続）。 | `application/persist/backend.js: resolvePersistBackend/chooseBackend/diagnosePersistFallback` |
| **メモリ像（image / buildImage）** | 全記録の同期読み取り用のインメモリ表現（6マップ）。 | `application/persist/memoryStore.js: buildImage` |
| **write-through** | 書込みをメモリ像へ即時反映しつつ Worker（SQLite）へ非同期に流す方式。 | `application/records.js` |
| **hydrate** | 起動時に永続層からメモリ像を構築すること。 | `infrastructure/db/initStorage.js` |
| **主タブ/副タブ・handoff** | 多タブ協調。Web Locks で主タブ1つを選出（副は read-only）、主が閉じたら昇格。 | `application/persist/election.js`, `infrastructure/persist/multiTab.js` |
| **縮退（fallback）／告知（persistNotice）** | 能力不足で memory へ落ちること／その穏やかな告知。 | `persist/backend.js`, `persist/persistNotice.js` |
| **自動復元（recovery）／外部バックアップ** | 起動時 integrity_check→内部バックアップから復元／FSA で外部フォルダへ書出し。 | `application/persist/recovery.js`, `application/externalBackup.js` |

---

## 2. 文脈候補（Bounded Context 候補）

このアプリは単一デプロイの小規模 SPA なので、**厳密な Bounded Context は現状ゼロ**（＝棚卸し結果どおり）。だが「もし境界を引くなら」を**学習のために**言語化する。以下は _候補_ であって現状の分割ではない。

| 文脈候補 | 責務 | 主なユビキタス言語 | 現在の実装位置 | Subdomain 種別（私見） |
|---|---|---|---|---|
| **Play（プレイ/入力判定）** | 出題→打鍵→採点。1回のプレイの進行。 | passage/set/drill・quiz・mode・acceptsRomaji・score・shouldFinish | `domain/{romaji,typing,marathon,words,dictionary,touch,story}`＋`@tll/core`＋`application/use*` | **コア**（このアプリの差別化＝日本語タイピングの入力判定） |
| **Records（記録/達成）** | 記録の生成・ランキング・収録統計。 | record・ranking・recKey・MAX_RECORDS・isRecordable | `domain/records/*`＋`application/records.js`＋`AllRecordsView` | 支援（コアを支えるが差別化要因ではない） |
| **Content（教材オーサリング）** | 単語/英英/例文/物語のデータと整合性。 | word/dict/sentence/story・level/theme・gloss/ruby | `content/*.ndjson`（正典）→`src/content/*Data.js`（生成物） | 支援（教材が価値の源泉の一部） |
| **Persistence（永続化/同期）** | 保存・多タブ・復元・バックアップ。 | backend・image・write-through・hydrate・主/副タブ・recovery | `application/persist/*`＋`infrastructure/{db,persist}/*` | **汎用**（SQLite/OPFS 同期は業界共通の課題） |

> 種別の使い分け：コア＝最も投資すべき／支援＝コアを支える自作／汎用＝どの製品でも似た領域（既製品寄り）。**Persistence は汎用**（SQLite-WASM/OPFS という汎用技術）で、実際に外部ライブラリ（`@sqlite.org/sqlite-wasm`）に強く依存している＝汎用サブドメインの典型。

---

## 3. Context Map（素描）

現状の"相当物"を DDD 連携パターンの語で読み替える（Phase 10 で正式化する下地）。

```
        ┌───────────────┐         ┌───────────────┐
        │     Play      │ ──uses─▶│    Records    │
        │ (コア/入力判定) │  記録を  │ (支援/ランキング)│
        └───────┬───────┘  生成    └───────┬───────┘
                │                          │
           uses │ 教材                save │ 記録
                ▼                          ▼
        ┌───────────────┐         ┌───────────────┐
        │    Content    │         │  Persistence  │
        │ (支援/教材)     │         │ (汎用/保存・同期)│
        └───────────────┘         └───────┬───────┘
                                           │ ACL
                                           ▼
                                   @sqlite.org/sqlite-wasm・OPFS・FSA（外部技術）
```

- **Shared Kernel（共有カーネル）**：`@tll/core`（romaji/typing の純ロジック）を app・`@tll/ui`・外部 `claude.ai/design` が共有。※単一著者の内部共有で、本義の「別チーム間合意」ではない。
- **Published Language（公表された言語）**：`content/*.ndjson`（正典ソース）→ 生成物 `src/content/*Data.js`。教材の交換フォーマットに相当（ビルド内規約）。
- **Anti-Corruption Layer（腐敗防止層）**：`infrastructure/db/initStorage.js` の `handle`（exec/hydrate/save…）＋`db/repos/_codec.js`（列⇄record 翻訳）が、`@sqlite.org/sqlite-wasm`/OPFS/postMessage という外部技術を内側の語彙へ変換する。→ Persistence 文脈が外部技術の詳細に侵食されないための層。
- **Open Host Service（公開ホストサービス）相当**：`@tll/core`/`@tll/ui` の barrel（`index.ts`）が公開インターフェース。
- Play→Records は **Customer/Supplier 的**（Play が記録を生み、Records がそれを受けて並べる）。ただし単一コードベースゆえチーム交渉は無い。

---

## 4. この Phase 0 から得た設計上の含意（Phase 1 への橋渡し）

- **Records が集約中心 DDD の最良の教材**：`record`（値）と `ranking`（top15＋順序の不変条件）が既に純関数（`rankInsert`）で分離済み。ここを VO→集約（`RankingBoard`）→Repository へ育てるのが自然。
- **`endCondition {kind,value}` は最初の Value Object 候補**：Play と Records の両文脈をまたいで使われる基礎値。まず VO 化（Phase 1）すると、`shouldFinish`/`endConditionTag`/`compareRecords` の入口検証が一本化でき、以降の集約設計が楽になる。
- **Persistence（汎用/ACL 済み）は DDD 化の対象外**でよい：外部技術の変換層は既に機能しており、集約や Domain Event を無理に被せない。

---

## 5. Phase 1 記録：Value Object（EndCondition）

**やったこと**：`endCondition {kind,value}` を Value Object へ育てた（`domain/session/endCondition.js`）。

### VO の4性質を、このコードでどう満たしたか
| VO の性質 | 実装 |
|---|---|
| **不変（immutable）** | `makeEndCondition` が `Object.freeze` した値を返す。以後 `value` を書き換えても変わらない。 |
| **自己検証（self-validating / 不変条件）** | ファクトリ内で検証：未知 kind／counted 系（time/chars/items/life）の value が「正の有限数」でない → **throw**。「不正な EndCondition は生成できない」＝生成時点で不変条件を保証。 |
| **値等価（value equality）** | `endConditionEquals(a,b)`＝kind・value 一致で等しい（同一性ではなく値で比較）。 |
| **生成の一元化（factory）** | 生 `{kind,value}` リテラルの散在（両ファイルの `DEFAULT_END_CONDITION` 重複・App.jsx インライン）を **`makeEndCondition` 1経路に集約**。`content/endConditions.js` と `App.jsx` の生成をファクトリ経由へ。 |

### 学びの要点
- **「throw する VO」と「throw しない入口」を分ける**：ドメイン内の生成（信頼できる）は `makeEndCondition`（fail-fast＝不変条件を厳格に守る）。一方、**未信頼入力**（URL param・localStorage・過去データ）は `normalizeEndCondition` が**寛容に妥当な VO へ吸収**する入口アダプタ。この2層（厳格な生成＋寛容な正規化）は、ドメインの不変条件を守りつつ外界の乱れを堰き止める定石。→ 後の **ACL（Phase 10）** に通じる考え方。
- **VO は「値」であって「実体」ではない**：EndCondition に ID もライフサイクルも無い。同じ `{time,60}` はどれも交換可能。次の **Phase 2（Entity）** で、逆に「ID と可変状態を持つ実体（TypingSession）」と対比するとこの違いが際立つ。
- **JS での VO の作り方**：class を使わずとも「ファクトリ関数＋`Object.freeze`＋値等価関数」で VO の本質（不変・自己検証・値等価）は表現できる（この関数型コードベースに馴染む形）。型（TS）まで入れると「不正な値がそもそも代入できない」保証が強まるが、今回は実行時検証で代替。

### before / after（生成の集約）
- before：`{ kind: 'time', value: 60 }` が domain・content・App.jsx に散在し、検証も凍結も無し。
- after：`makeEndCondition('time', 60)`（凍結・検証済み）。「終了条件はこの関数でしか作れない」に寄せた。

---

## 6. Phase 2 記録：Entity（TypingSession）

**やったこと**：プレイ1回を `TypingSession` **Entity** として domain に新設（`domain/session/typingSession.js`）。前 Phase の EndCondition **VO を内包**する。

### VO と Entity の違い（この2つを並べると本質が見える）
| | Value Object（EndCondition） | Entity（TypingSession） |
|---|---|---|
| **同一性** | 無し。値が同じなら同じ（`endConditionEquals`＝値等価） | **ID を持つ**。`sessionEquals`＝**ID 一致**で等価 |
| **可変性** | **不変**（`Object.freeze`） | **可変**（`registerHit/registerMiss/advanceItem/setElapsed/finish` で状態が変わる） |
| **ライフサイクル** | 無し（ただの値） | **あり**（active → finished） |
| **不変条件** | 生成時に検証（不正は作れない） | **生成後も守る**（finished 後の状態変更は throw） |
| **等価の意味** | 「同じ 60 秒設定」はどれも交換可能 | 「同じ ID」なら**進捗が変わっても同一の実体**。逆に「別 ID・同じ進捗」は別物 |

### 学びの要点
- **同一性 vs 値等価が Entity と VO を分ける唯一絶対の基準**。テストで `sessionEquals(同id, 別進捗)===true` かつ `sessionEquals(別id, 同値)===false` を固定したのが核心。VO は逆（値が同じなら等価）。
- **ID は純ドメインでは作れない → 注入する**：`startTypingSession({ id, endCondition })`。ドメインは乱数/時刻を持たない（決定性・テスト容易性）。ID の採番は外側（app/infra/Repository）の責務。→ Phase 4 の Repository でこの ID 採番・再構築を扱う。
- **Entity は VO を内包する（合成）**：`TypingSession` が `EndCondition` VO を持つ。不正な終了条件では Session を始められない（生成時に `isEndCondition` で検証）。「Entity＝VO を組み合わせて状態と振る舞いを持たせたもの」という関係。
- **`status`（明示終了）と `isFinished()`（終了条件連動）の分離**：`finish()` でのみ status が 'finished' になり、以後の状態変更を禁止（不変条件）。一方 `isFinished()` は「明示終了 or `shouldFinish(endCondition, progress)`」の論理和。時間到達＝プレイ的には終了だが、状態機械上はまだ更新を受け付ける、という現実に即した2層。
- **カプセル化**：内部 `progress` は外に晒さず、`progress()` が毎回**凍結スナップショット**を返す。外から内部状態を壊せない＝Entity が自分の不変条件を守れる前提。

### 補足（この関数型コードベースでの割り切り）
domain の他コードは純関数・不変で統一されているが、Entity はあえて**メソッドで状態を変える可変オブジェクト**にした。これは「Entity は本質的に stateful」という DDD の主張を体験するための意図的な対比。実運用でこの Entity を使う（Phase 8 で `use*` フックから駆動する）かは別途判断する。

---

## 7. Phase 3 記録：Aggregate / Aggregate Root / Invariant（RankingBoard）

**やったこと**：記録ランキングを `RankingBoard` **集約**として新設（`domain/records/rankingBoard.js`）。集約ルートが「top15・整列」の**不変条件を保証**する。

### 集約の3要素をこのコードでどう表したか
| 要素 | 実装 |
|---|---|
| **集約（Aggregate）** | `RankingBoard` = ルート＋内部の記録エントリ群（値）を1つの整合性単位として束ねる。 |
| **集約ルート（Aggregate Root）** | `RankingBoard` オブジェクト。外部は**ルート経由でのみ**記録を追加できる（`submit`）。内部 entries を直接触れない。 |
| **不変条件（Invariant）** | 「entries は常に `compareRecords(endCondition)` で整列済み・`MAX_RECORDS`(15) 件以下」。**生成時に正規化**し、`submit` でも維持。どの操作の後も真。 |

### 学びの要点
- **不変条件を"守る場所"を1点に集約した**：これまで `rankInsert`（純関数）は誰でも直接呼べた＝不変条件を守る責任が呼び出し側に散っていた。集約はそれを**ルートの内側に隠蔽**（`rankInsert` は module 内でのみ使用）し、「記録は `submit` を通してしか入らない＝常に整列・上限が守られる」を構造で保証する。これが「集約＝整合性の境界」。
- **境界の外からは entries を壊せない**：`entries()` は凍結スナップショットを返すのみ。外から配列を書き換えても集約内部は不変（カプセル化）。不変条件を守るには「内部状態を晒さない」が前提。
- **集約ルートは Entity（同一性を持つ）**：`RankingBoard` の identity は `key`（recKey 相当）。`rankingBoardEquals` は key 一致で等価＝どのランキングか、で同一性を判断。中の記録（値）が変わっても「同じランキング」。
- **集約は VO を内包する**：`endCondition`（Phase 1 VO）を持ち、並び順の規則（`compareRecords`）を決める。VO→Entity→Aggregate と**部品が積み上がっている**のが見える（VO を Entity が持ち、Entity 的な集約ルートがそれを使う）。
- **可変/不変は集約の本質と直交**：今回 `submit(record)` を**イミュータブル**（新しい board を返し元は不変）にした。Phase 2 の Entity は可変メソッドだった。**どちらでも「ルートが不変条件を守る」は成立する**——DDD が要求するのは「不変条件の保護」であって「mutation するかどうか」ではない、という重要な気づき。この関数型コードベースには不変スタイルが馴染む。

### 「集約があって初めて Repository が意味を持つ」への布石
次の Phase 4（Repository）は、この `RankingBoard` を**丸ごと保存・再構築する抽象**を作る。集約という「保存の単位」が定義できたので、Repository が「コレクションのように集約を出し入れする」意味を持てる（集約なき Repository はただの DAO）。

---

## 8. Phase 4 記録：Repository（RankingRepository）

**やったこと**：Phase 3 の `RankingBoard` 集約を「コレクションのように出し入れする永続化抽象」＝`RankingRepository` として新設（`domain/records/rankingRepository.js`）。安全のため実 sqlite には触れず、**in-memory アダプタ**で完結（学習用）。

### Port / Adapter（Hexagonal）をこう表した
```
[ドメイン/アプリ] ── uses ──▶ createRankingRepository(store)
                                      │ depends on
                                      ▼
                                  store（Port）＝ { load(key), save(key, records) }
                                      ▲ implements
              ┌───────────────────────┼───────────────────────┐
   createInMemoryRankingStore（学習用）        （実）sqlite の *Db アダプタ（今回は未配線）
```

### 学びの要点
- **「集約があって初めて Repository が意味を持つ」を体験**：Phase 3 で `RankingBoard`（保存の単位＝集約）を定義したから、Repository が「集約を丸ごと出し入れする」意味を持てた。集約が無ければ Repository はただの行 CRUD（DAO）になる。`findByKey` は行から**集約を再構築**し、`save` は**集約全体**を書き出す。
- **永続化無知（persistence ignorance）**：`createRankingRepository(store)` は注入された `store`（Port）だけに依存し、SQLite も OPFS も知らない。`store` を in-memory にもモックにも差し替えられる（テストで実証）＝ドメインが永続化技術から独立。実運用では `store` を `db/repos/*Db` 実装に差し替えれば同じ Repository が sqlite で動く。
- **`submitRecord` = read-modify-write を1点に**：「load（無ければ空集約）→ `submit` → save」を Repository の1メソッドに閉じ込めた。集約の不変条件（top15・整列）が **Repository 経由でも保たれる**（満杯超過 submit でも 15 件維持）。呼び出し側は不変条件を意識しない。
- **Port の向き**：Repository のインターフェース（Port）は内側（domain/application）が定義し、実体（Adapter）は外側（infrastructure）が満たす＝**依存の逆転**。ドメインが「こういう保存口が欲しい」と宣言し、インフラが従う。

### 現実との接続（正直な注記）
このアプリの実際の永続化は既に `application/records.js` ファサード＋`db/repos/*Db`＋メモリ像で動いており（#264 で出荷済み）、**この学習用 RankingRepository は本番経路に配線していない**。「集約を Repository で出し入れする」形を体得するのが目的。本番に採用するかは別判断（棚卸しでは "実利は薄い" と評価＝過剰適用に注意）。

---

## 9. Phase 5 記録：Domain Service / Factory

**やったこと**：`createTypingSessionFactory`（Factory・`domain/session/typingSessionFactory.js`）と `sessionToRecord`（Domain Service・`domain/records/sessionResult.js`）を新設。

### Factory：生成をカプセル化し、同一性を注入する
- `createTypingSessionFactory(nextId)` の `nextId` は `()=>string` の **ID 生成器（注入）**。`factory.start(endCondition)` は毎回 `nextId()` で採番して Session を作る。
- **学び**：純ドメインは Date/乱数/counter を持てない（決定性）。だから **ID の源は外から注入**する。Factory は「採番＋VO 合成＋Entity 生成」という生成手順を1箇所に閉じ込め、呼び出し側は「終了条件を渡せば妥当な Session が返る」だけを知る。実運用では uuid や連番を注入すればよい（Phase 4 の Repository が採番と再構築を担うのも同じ考え）。

### Domain Service：どの Entity にも属さないロジックの居場所
- `sessionToRecord(session, meta)`：`TypingSession`（Entity）の状態＋`score`（採点）＋外部 `meta` をまたいで**記録値**を作る。
- **学び**：この変換は Session だけの責務でも、記録値だけの責務でもない（**複数の部品をまたぐ**）。「どの Entity/VO に置くと不自然か？」→ どれにも属さないなら **Domain Service**。ただし乱用注意：Entity/VO に自然に置ける振る舞いをサービスに逃がすと"貧血ドメイン"になる。今回は「またぐから」置いた。
- Service は**状態を持たず副作用もない**（`progress()` を読むだけ・session 非破壊）。ステートレスなドメイン操作＝テストが楽。

### 部品の積み上がり（ここまでの合成関係）
```
EndCondition(VO) ──held by──▶ TypingSession(Entity) ──created by──▶ Factory(nextId 注入)
        │                          │
        │                          └──read by──▶ sessionToRecord(Domain Service) ──▶ record(値)
        └──ordering rule──▶ RankingBoard(Aggregate) ◀──stored by── RankingRepository(Port)
```
VO を Entity が持ち、Entity を Factory が作り、Entity から Service が記録値を作り、記録値を Aggregate が束ね、Aggregate を Repository が出し入れする——**戦術パターンが1本の線でつながった**。

---

## 10. Phase 6 記録：Specification

**やったこと**：汎用コンビネータ `makeSpec`（`domain/spec/specification.js`）と、それで組んだ記録向け具体 spec（`domain/records/recordSpecs.js`：`fasterThan`/`atLeastAccuracy`/`longerThan`／合成 `isGreatRecord`）を新設。

### 学びの要点
- **条件を"オブジェクト"にする**：`record.speed > 300 && record.accuracy >= 95` のような分岐式を、`fasterThan(300).and(atLeastAccuracy(95))` という**合成可能な値**にした。条件が名前を持ち（`isGreatRecord`）、渡せる・組み替えられる・テストできる。
- **and/or/not で代数的に合成**：`makeSpec` が返す Specification は `and/or/not` で新しい Specification を返す（**閉じている**＝合成結果もまた Specification）。しかも**非破壊**（元 spec は不変）。真理値表を組み合わせるだけで複雑な条件が宣言的に書ける。
- **どこで効くか**：終了条件の判定（`shouldFinish`）、記録の採用可否（例：「endless は30秒以上で記録」「touch は非記録」）、出題フィルタなど「条件が増える・組み変わる」場所。分岐が式で散らばる前に spec に寄せると、条件の再利用と単体テストが楽になる。
- **正直な適用範囲**：このアプリの現状の条件は単純（switch で足りる）ので、Specification は**学習主目的**。乱用すると単純な `if` が過剰に抽象化される。「条件が3つ以上 and/or で絡む・再利用する・組み替える」時に価値が出るパターン、と理解しておく。

---

## 11. Phase 7 記録：Domain Event

**やったこと**：不変イベント値 `sessionFinishedEvent`/`recordAchievedEvent`（`domain/events/recordEvents.js`）と、同期 in-memory の `createEventBus`（`application/events/eventBus.js`）を新設。

### 学びの要点
- **Domain Event＝"起きた事実"の不変な値**：`{ type:'SessionFinished', sessionId, record }` を `Object.freeze`。過去形の名前（Finished/Achieved）で「もう起きたこと」を表す。VO 的（不変・payload 注入・時刻もドメインで作らず注入）。
- **発行側は購読側を知らない（疎結合）**：`bus.publish(event)` は誰が反応するかを気にしない。`bus.subscribe(type, handler)` した側が勝手に反応する。→ 「記録できた」→ 収録統計を更新する／多タブへ通知する／実績を出す、を**発行側を変えずに足せる**。
- **層の置き場所**：イベント値は domain（不変の事実）、バス（購読レジストリ＝可変状態）は application。
- **このアプリの現状との対応**：既存の `records.js` の `broadcastChange`（多タブ通知）や `itemTracker`（収録統計）は、本来 `RecordAchieved` を購読して反応する形にできる。ただし今回は**加算的に導入**し、リリース済みの実配線は変えていない（安全優先）。実導入すると「記録保存の中で通知や統計更新を直接呼ぶ」密結合をイベント購読へ置き換えられる、というのが狙い。
- **正直な適用範囲**：単純な同期処理では過剰。「1つの出来事に複数の"ついで処理"がぶら下がる／それが増える」時に疎結合が効く。イベントソーシング（Phase 棚卸しで非該当）とは別物＝ここでは"通知"としてのイベント。

---

## 12. Phase 8 記録：Application Service（capstone）

**やったこと**：`recordFinishedSession`（`application/records/recordFinishedSession.js`）＝これまでの全戦術部品を**1つのユースケースに調停する薄い層**。

```
recordFinishedSession({ session, meta, repository, bus })
  1. record = sessionToRecord(session, meta)        ← Domain Service（変換）
  2. key    = recKey(meta..., session.endCondition) ← Domain（VO を使う）
  3. board  = repository.submitRecord(key, ec, record) ← Repository（集約を RMW・不変条件維持）
  4. bus.publish(sessionFinishedEvent(...))         ← Domain Event（通知）
  5. bus.publish(recordAchievedEvent(...))
  return { record, key, board }
```

### 学びの要点
- **Application Service は"薄い"＝業務ルールを持たない**：計算（採点）は Domain Service、整列・上限は Aggregate/Repository、通知は Event に**委譲するだけ**。App Service 自身は「順番に呼ぶ」調停に徹する。テストで「App Service が独自計算していない（record が `sessionToRecord` の結果と完全一致）」を固定したのがその証明。
- **capstone＝全部品が1本に集まる**：VO(EndCondition)→Entity(TypingSession)→Factory→Domain Service(sessionToRecord)→Aggregate(RankingBoard)→Repository→Domain Event の**全部**がこの1関数で協調する。戦術パターンは単体では小さいが、ユースケースで組み合わさって初めて「アプリの1操作」になる。
- **依存はすべて注入**：`repository`・`bus` を引数で受ける（Port）。App Service はどの永続化・どのバス実装かを知らない＝テストは in-memory で完結。
- **現実との関係**：既存の「プレイ完走→記録保存→多タブ通知」は、この App Service の形に寄せられる（実フックからの呼び出しは今回は未配線＝加算的。棚卸しでも "実利は薄い" と評価した通り、学習用の完成形）。

---

## 13. Phase 9 記録：Bounded Context / Context Map（戦略）

Phase 0 で素描した文脈候補を、戦術を作った経験を踏まえて具体化する。

### 4つの文脈（候補）と、そこに属する戦術部品
| 文脈 | 種別 | 属する部品（今回作った/既存） | ユビキタス言語 |
|---|---|---|---|
| **Play** | コア | `domain/{romaji,typing,marathon,words,dictionary,touch,story}`・`TypingSession`(Entity)・`Factory`・`EndCondition`(VO) | passage/drill/quiz・acceptsRomaji・score・shouldFinish・session |
| **Records** | 支援 | `RankingBoard`(Aggregate)・`RankingRepository`・`sessionToRecord`(Service)・`recordSpecs`・`recKey` | record・ranking・rankInsert・isRecordable |
| **Content** | 支援 | `content/*.ndjson`→生成物・`domain/*/…set.js` の出題データ | word/dict/sentence/story・level/theme |
| **Persistence** | 汎用 | `application/persist/*`・`infrastructure/{db,persist}/*` | backend・image・write-through・hydrate・主/副タブ |

### 学びの要点
- **同じ「記録」でも文脈で意味が違う**：Play にとって記録は「終わったら生まれる副産物」、Records にとっては「並べ替え・保持する主役」、Persistence にとっては「SQLite の行」。**1つのモデルを全文脈で共有しない**のが Bounded Context の要点（同じ語 record が文脈ごとに別の関心を持つ）。
- **境界は"言葉が一貫して通じる範囲"**：Play 内では `session`/`shouldFinish` が自然に通じ、Persistence 内では `hydrate`/`write-through` が通じる。用語がブレる所が境界の候補。
- **この規模での正直な評価**：単一デプロイの小アプリなので**物理的な境界（別モジュール/別サービス）は過剰**。だが「文脈ごとにモデルと語彙を分けて考える」思考法は、機能追加時に「どの文脈の話か」を問える点で有効。→ 棚卸しの「戦略 DDD は大半が非該当」と整合（実装はしないが、考え方は使える）。

### Context Map（関係）
```
  Play ──(記録を生む/Customer)──▶ Records ──(集約を保存)──▶ Persistence
   │  Supplier                       │                        │ (ACL)
   └──(教材を使う)──▶ Content        └──(集約を出し入れ)──────┘  ▼ 外部技術(sqlite/OPFS/FSA)
```

---

## 14. Phase 10 記録：連携パターン（ACL / Shared Kernel / Published Language・戦略）

文脈間・外部との連携を DDD の語で明示する（既に"相当物"は存在＝命名・自覚がゴール）。

| パターン | このコードの実体 | 意味 |
|---|---|---|
| **Anti-Corruption Layer（ACL）** | `infrastructure/db/initStorage.js` の `handle`＋`db/repos/_codec.js`（列⇄record 翻訳）＋`sqliteWorker` | 外部技術（`@sqlite.org/sqlite-wasm`・OPFS・postMessage）の詳細が Persistence/Records のモデルに**侵食しないよう変換**。Records は「集約を save/load」しか知らず、SQL/列/Worker を知らない。**Phase 1 の「厳格な生成＋寛容な入口（normalize）」も同じ発想**＝外界の乱れを堰き止める層。 |
| **Shared Kernel** | `@tll/core`（romaji/typing の純ロジック）を app・`@tll/ui`・claude.ai/design が共有 | 複数利用者が**合意の上で共有する中核**。変更は影響範囲が広い＝慎重に。※単一著者の内部共有で本義（別チーム合意）とは異なる。 |
| **Published Language** | `content/*.ndjson`（正典）→ 生成物 `src/content/*Data.js`／`@tll/ui` の型 export | 交換のための**文書化された共通フォーマット**。教材の正典を NDJSON に定め、生成物はそれに従う。 |
| **Open Host Service（相当）** | `@tll/core`/`@tll/ui` の barrel（`index.ts`）＝公開インターフェース | 多数の利用者向けに公開された入口。 |
| **Customer / Supplier** | Play（上流＝記録を生む）→ Records（下流＝受けて並べる） | 上流の変更が下流に影響する協力関係（単一コードゆえチーム交渉は無いが、依存の向きは同じ）。 |

### 学びの要点
- **DDD の戦略パターンは"新しく作る"より"既にある関係に名前を付ける"ことが多い**：ACL も Shared Kernel も Published Language も、実は #264 の永続化や `@tll/core` 分離で**既に実現していた**。名前を与えると「なぜその層があるか」をチームで共有でき、壊してよい/いけない境界が明確になる。
- **ACL が最重要**：外部技術（sqlite-wasm）への依存を1点に閉じ込めているから、将来 IndexedDB 等へ替えても Records/Play は無傷。境界を守る投資が効いている。

---

## 15. 総括：この学習で何を得たか

| レイヤ | 採用の実態（学習後） |
|---|---|
| **戦術（Phase 1-8）** | VO/Entity/Factory/Domain Service/Aggregate/Repository/Specification/Domain Event/Application Service を**一通り実装して体得**。ただし多くは `domain/` に**加算的**に作った学習用で、リリース済みの本番経路（records.js/*Db/フック）には未配線（安全優先）。 |
| **戦略（Phase 0,9,10）** | Bounded Context/Context Map/連携パターンを**言語化**。物理的な境界分割はこの規模では過剰だが、「文脈ごとにモデルと語彙を分ける」思考と、既存の ACL/Shared Kernel/Published Language への**自覚**を得た。 |

### 一番の学び（3つ）
1. **部品は単体では小さく、ユースケースで組み合わさって意味を持つ**（Phase 8 の capstone で VO→…→Event が1本に繋がった）。
2. **DDD が要求するのは"不変条件の保護"であって mutation の有無ではない**（Entity＝可変・Aggregate＝不変、どちらでも不変条件は守れた）。
3. **過剰適用への自制**：この規模では集約/Repository/戦略 DDD の多くは"実利が薄い学習"。**いつ使うか（不変条件が重い・条件が絡む・境界がブレる）を判断できる**ことが、パターンを覚えること以上に重要。

### 今後（任意）
- 本番採用したいものだけ選んで配線する（例：`endCondition` VO は既に本番化済み＝Phase 1 が唯一"実利ありで採用"）。
- 残りの戦術部品（Entity/Aggregate/Repository/Event/App Service）は `domain/`・`application/` に学習用として在り、必要になった時の下地になる。

---

## 16. Phase 2b 記録：Entity を実フックに配線（TypingSession × useRomaji）

**やったこと**：学習で作った `TypingSession` Entity と `createTypingSessionFactory` を、**実運用中のフック `useRomaji`（ローマ字練習）に実採用**した。`keys`/`mistakes`/`finished` を Entity の `progress()`/`status()` へ集約（挙動は完全同一・既存テスト無編集で緑）。これは「加算的な学習」ではなく**本番コードへの初の DDD 部品採用**（endCondition VO に続く2例目）。

### 一番の学び：可変 Entity と React の摩擦、そして定石
- Entity は**可変**（`registerHit()` で内部状態が変わる）。一方 React は**不変 state の差し替え**で再描画する。素朴に「ref に Entity を持ち、render 中に `sessionRef.current.progress()` を読む」とすると、**`react-hooks/refs`（render 中に ref を読むな）で lint エラー**になる（render の純粋性を壊すため）。
- 解決＝**「Entity は ref、投影(snapshot)は state」**：
  1. 可変 Entity は `useRef` に置く（React の管理外の"生きているオブジェクト"）。
  2. **イベントハンドラの中だけ**で Entity を変更し、直後にその**現在像を state へ sync**（`setSnap({ keys, mistakes, finished })`）。
  3. render は state（像）だけを読む＝純粋・lint クリーン・挙動不変。
- これは DDD と React の**世界観の違いを橋渡しするパターン**：ドメインは可変な実体で状態遷移を表し、UI 層はその"スナップショット"を不変 state として受け取る。ドメインの表現力（Entity の振る舞い）を保ちつつ、React の制約に従える。今後 `useTouch`/`useMarathon` 等を Entity 化する際も同じ形が効く。

### 設計判断のメモ
- **finish のトリガはタイマー据え置き**：タイミング差を出さないため、60秒の終了は従来の `useCountdownTimer` の `onTimeout` で `session.finish()` を呼ぶだけにした（isFinished の shouldFinish 経路は使わず）。「挙動不変」を最優先にすると、Entity は"状態の器"として使い、既存の副作用配線（タイマー・音・キー入力）は残すのが安全。
- **restart は session 差し替え**：`factory.start()` で新しい Entity を作れば keys/mistakes/status が一括リセット＝個別の setState 群が1行になった（Entity 化の副次的な整理効果）。

### 正直な評価
- 実利は中程度：`useRomaji` の状態管理が「散らばった setState」から「Entity＋像の sync」に整理され、可読性は上がった。ただしこの1フックだけでは劇的な差ではない。**価値は"横展開したときの一貫性"**（全プレイフックが同じ Entity/パターンを共有）に出る。全フック展開するかは費用対効果で判断（今回は useRomaji の1例で"実採用の感触"を掴むに留める）。

---

## 17. 追記：依存逆転で層スメルを解消（contentFallback）

**やったこと**：`content/contentFallback.js`（教材 SQLite→.js フォールバック回数の観測テレメトリ）が **content 層で localStorage を直接 I/O** していた層スメルを、**依存逆転（Dependency Inversion）**で解消した。

### before / after
- **before**：content が localStorage/window を直接書く（content＝データ層が I/O を持つ＝方向の乱れ）。単純に「localStorage を infra に寄せる」と `content → infra` の逆向き依存になり解決しない。
- **after**：
  - `content/contentFallback.js`＝**純粋な発生シグナル**（counts＋`notify({source,error})`＋subscribe）。I/O を持たない。
  - `infrastructure/observability/contentFallbackStore.js`＝content の**シグナルを購読**して localStorage/window へ永続化。`infra → content`＝**内向きの正しい依存方向**。
  - `main.jsx`（合成根）で `startContentFallbackPersistence()` を起動。

### 学びの要点
- **依存の向きは"呼ぶ側"ではなく"依存する側"で決まる**：I/O を infra に置くだけでは、content が infra を呼べば逆流する。**「content は出来事を通知するだけ・infra がそれを購読して外部化する」**と、依存の矢印が infra→content（内向き）になる。これが依存逆転の肝。
- **Domain/Content は"何が起きたか"を発し、外側が"どう外部化するか"を担う**：Phase 7 の Domain Event と同じ構図（発行側は購読側を知らない）。今回はイベントバスではなく既存の subscribe 機構でそれを実現した。
- **観測挙動は不変**：localStorage `content-fallback-v1`・`window.__contentFallbacks` は今も書かれる（書く主体が content→infra へ移っただけ）。UI のフォールバック告知（`useContentFallback` の boolean 購読）も無影響。責務を分けても外から見た振る舞いは同じ、が良いリファクタの証。
- **正直な注記**：この層スメルは低価値（DevTools テレメトリ1カウンタ）で、当初は"見送り"も選択肢だった。実施したのは**依存逆転の実例として学ぶため**。実務では「価値に対して indirection が過剰でないか」を毎回問うべき（過剰適用への自制）。ただし今回は既存 subscribe を再利用できたため indirection の追加は小さく、割に合った。

---

## 18. 追記：Domain Event を本番の多タブ通知へ配線（RecordsChanged）

**やったこと**：Phase 7 で作った Domain Event/バスを本番へ。`records.js` の write-through 後の**多タブ変更通知**を、`RecordsChanged` ドメインイベント＋イベントバス経由にした（`domain/events/recordEvents.js` に `recordsChangedEvent`、`infrastructure/persist/multiTab.js` にバス挿入）。

### 配線（挙動不変）
```
records.js: writeThrough → onChange(epoch)           ← records.js は無変更（注入コールバックを呼ぶだけ）
multiTab.js: onChange = () => bus.publish(RecordsChanged{epoch})
             bus.subscribe('RecordsChanged', e => post({type:'change', epoch:e.epoch}))  → BroadcastChannel で副タブへ
```
同期バスなので「publish 内で即 subscriber が同一 epoch の change を1回 post」＝メッセージ・回数・タイミング不変。pwa-verifier が2タブで **change 観測 11=11（二重post/欠落なし）・epoch 正・handoff/永続 OK** を実観測。

### 学びの要点（正直な総括）
- **既に注入コールバックで疎結合だった所に、名前付きイベント＋バスを差した**：records.js は元々「注入された onChange を呼ぶ」だけで多タブの詳細を知らない＝**既に依存逆転済み**だった。今回の変更は「その匿名コールバックを `RecordsChanged` という**名前付きの事実**にし、バスで複数購読可能にした」もの。
- **価値は"今"ではなく"拡張余地"**：現状 `RecordsChanged` の購読者は多タブ post の1本だけ＝実利は薄い（棚卸し通り）。バスの価値は「将来この事実に別の反応（例：実績解除・分析）を**発行側を触らず**足せる」拡張性にある。**1購読者なら素の注入コールバックで十分**、という判断基準を実地で確認できた。
- **"本番に配線して初めて分かること"**：可変 Entity×React（Phase 2b の ref/state）、依存の向きは依存する側で決まる（第17節）、そして今回の「既存の疎結合をイベントに昇格する時のコスト対効果」——**学習アーティファクトを本番に載せる作業自体が、パターンの適用可否を最も鋭く教える**。これが #290 学習アークの最大の収穫。

---

## 19. 追記：複雑フックへの"部分採用"（useWords×Entity）

**やったこと**：`useWords`（単語入力・最も複雑なプレイフック）に `TypingSession` Entity を**部分採用**。`keys`(打鍵数)/`mistakes`(ミス数) の2値**だけ** Entity に集約し、`items`/`life`(missedItems)・二重 finish 経路・`segTracker`・タイマーは**据え置いた**。

### なぜ"全部"ではなく"一部"か
- useWords の `items`/`life` は**単純カウンタではなく `segTracker` から導出**（「一発正解の問題数」「ミスした問題数」）。Entity の `advanceItem/missedItems` の counter モデルとは**意味論が違う**。無理に全部を Entity に移すと、segTracker と二重管理になり境界（life の1ミス即終了・items の完了判定）を壊すリスクが高い。
- そこで **Entity がきれいに写る keys/mistakes だけ**を移し、合わない部分は既存のまま共存させた。ui-auditor が time/chars/items/life/endless の全終了条件で非退行を実測（off-by-one なし）。

### 学びの要点
- **DDD は"全部入れ替える"ものではない**：1つのフックの中で「Entity が持つべき状態（keys/mistakes）」と「別の集計器が持つべき状態（segTracker の items/life）」は**共存してよい**。パターンは"合う所に合う分だけ"当てる。
- **部分採用は"どこまでが Entity の責務か"を線引きする練習**：keys/mistakes は「打鍵の進捗」＝Entity の progress に自然。items/life の"問題単位の成否"は segTracker という別の集計の関心。境界を無理に消さないのが正解。
- **リスク管理**：リリース済みの複雑ゲームプレイ（21テスト・5終了条件）を、①既存テストを安全網に、②スコープを keys/mistakes に限定、③ui-auditor で全モード実測、の三段で守った。「高リスクにあえて進む」時ほど**スコープを小さく・網を厚く**。

---

## 20. 命名規約：ファイル名の DDD ステレオタイプ・サフィックス（#306）

**課題**：コード上で VO / Entity / Factory 等の区別が散文コメントにしか無く、判別しにくかった。このコードベースは**ファクトリ関数ベースでクラスが無い**ため、「クラス名に `Entity` を付ける」に相当する印を**ファイル名**へ載せる。

**規約**：`src/domain/**` と `packages/core/src/**` の非テスト `.js`（barrel の `index.js` を除く）は、必ず次のサフィックスのいずれかで終える。

| suffix | stereotype | 例 |
|---|---|---|
| `.entity.js` | Entity（同一性・可変・ライフサイクル） | `typingSession.entity.js` |
| `.aggregate.js` | Aggregate Root（集約ルート・不変条件を根が保証） | `rankingBoard.aggregate.js` |
| `.vo.js` | Value Object（不変・値等価） | `endCondition.vo.js` / `kanaTable.vo.js` |
| `.factory.js` | Factory（同一性注入つき生成） | `typingSession.factory.js` |
| `.event.js` | Domain Event | `recordEvents.event.js` |
| `.specification.js` | Specification（`.spec` はテストと紛らわしいので不採用） | `combinators.specification.js` / `recordSpecs.specification.js` |
| `.repository.js` | Repository（Port） | `ranking.repository.js` |
| `.service.js` | Domain Service（純関数の判定/計算/変換・大多数） | `scoring.service.js` / `ranking.service.js` |

**強制**：`src/domain/_ddd-naming.test.js` が上記2ツリーを走査し、未分類ファイルがあれば**違反一覧を挙げて CI を赤**にする（新規ファイルにも分類を強制）。基底名が冗長になる所は基底も調整した（`rankingRepository.js→ranking.repository.js`・`typingSessionFactory.js→typingSession.factory.js`・`specification.js→combinators.specification.js`）。

**学びの要点**
- **名前は最も安いドキュメント**：散文コメントは腐るが、ファイル名は grep でき・タブに出て・テストで強制できる。ステレオタイプを名前に載せると「このファイルは何か」が読む前に分かる。
- **クラスが無くても戦術は表現できる**：OOP なら型名で背負う区別を、関数型スタイルでは**ファイル名の規約＋メタテスト**で担保できる。パターンは言語機能ではなく「意図の可視化と強制」で効く。
- **挙動不変の大規模リネームの安全網**：28ファイル改名＋約186 import 更新を、①メタテスト Red 先行 → ②`git mv`（履歴保持）→ ③`npm run check` 緑（1140 tests・build）で守った。ロジックに触れない機械的変更でも、差分が「パス差し替えのみ」であることを検証してからコミットする。

---

## 21. 命名規約を全層へ拡張（#308）

#306 の「ファイル名サフィックス＋メタテスト強制」を **application / infrastructure / ui** へ広げ、各層の役割もファイル名で判別可能にした。メタテストは層別構成（`_ddd-naming.test.js` の `TREES`）で、**ツリーごとに許可サフィックスを分けて**検査する（層をまたいだ誤サフィックスも検出）。

### 層別サフィックス
| 層（ツリー・拡張子） | サフィックス | 除外 |
|---|---|---|
| `src/infrastructure`（.js） | `.repository.js`（Repository 実装）／`.adapter.js`（Port 実装・ブラウザ/DB/Worker 配線）／`.migration.js`（DDL 定義）／`.schema.js`（適用ファサード）／`.mapper.js`（列⇄record 純マッパ） | — |
| `src/application`（.js） | `.service.js`（Application Service＝infra を束ねる副作用ファサード・機構）／`.policy.js`（純ロジック・判定/計算/状態機械/変換）／`.store.js`（module 可変ストア＋pub/sub） | `use*.js`（React フック） |
| `src/ui`（.jsx） | `.container.jsx`（フック/application/content を束ねる）／`.presenter.jsx`（@tll/ui 再エクスポート薄板）／`.context.jsx`（React Context） | `use*.jsx` |
| `packages/ui/src`（.tsx／.ts） | `.presenter.tsx`（純プレゼンター）／`.util.ts`（純計算・静的データ） | `*.stories.tsx`・`*.d.ts`・`index.ts` |

`.service.js` は domain（DomainService）と application（ApplicationService）で同綴りだが、**ディレクトリ（層）で意味が決まる**。

### 学びの要点
- **層で語彙が変わる＝ヘキサゴナルの実感**：domain は VO/Entity/…、infra は Adapter/Repository、application は Service/Policy/Store、ui は Container/Presenter/Context。同じ「ファイル名で役割を背負う」規約でも、**層ごとに登場するステレオタイプが違う**こと自体が層の責務境界を可視化する。
- **判定は"中身を読む"に尽きる**：planner が全ファイルを読み、司令塔の当初案の誤り（`allRecords`/`appMenu` は service でなく純関数＝policy、`schema.js` は DDL 本体でなく適用ファサード、src/ui に純再エクスポート薄板が11件）を是正した。命名は「そう呼びたい」ではなく「実際に何をしているか」で決める。
- **段階リリースの安全網**：application/infrastructure/ui の3層を **層ごとに Red→Green** で分け、各段で `npm run check` 緑（メタテストにその層のツリーを追加→当該層だけ赤→リネームで緑）を確認しながら積んだ。約155ファイル改名の大規模リネームでも、差分が「パス差し替えのみ」であることを層ごとに検証してコミットした。

---

_この文書は #290/#306/#308 の学習記録。ロードマップ Phase 0〜10 完走＋本番採用（VO・Entity×useRomaji/useTouch・useWords部分採用）＋層の健全化（L-2 逆流解消・contentFallback 依存逆転・endCondition/compareRecords の Strategy 化）＋Domain Event の本番配線（RecordsChanged）＋命名規約でステレオタイプをファイル名へ可視化・テスト強制（#306 domain/core → #308 全層）。DDD 学習アーク完了。_
