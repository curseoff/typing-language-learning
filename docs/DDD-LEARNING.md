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

> 次：**Phase 1（Value Object）** — `endCondition` を不変・自己検証・値等価を持つ VO へ（TDD）。

---

_この文書は #290 の学習記録。各 Phase 完了時に追記していく。_
