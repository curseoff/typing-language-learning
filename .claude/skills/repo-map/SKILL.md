---
name: repo-map
description: 「この変更ならこのファイル」の索引。機能名から触るべきファイル/ディレクトリを引くときに読む。どこを直せばいいか分からないとき、機能名（打鍵判定・対戦・記録・単語追加・PWA など）からファイルを探すとき、新しいファイルをどの層のどこに置くか迷うとき、ファイル名のサフィックス規約（*.service.js / *.container.jsx など）を確かめるときに使う。全文が要るときだけ docs/ARCHITECTURE.md を読む。
---

# リポジトリ索引（やりたいこと → 触るファイル）

**これは索引**。設計の背景・技術メモが要るときだけ `docs/ARCHITECTURE.md` を読む。

## 層

- 依存は内向き：`ui → application → domain`、`application → infrastructure`、各層 → `content`。パッケージは `src → @tll/ui → @tll/core`
- **`domain` と `@tll/core` は React/DOM 非依存**。`packages/ui` の presenter は**純粋描画**（`content`/`application`/`infrastructure`/フックを import しない）＝状態と配線は `src/ui/**` の container 側
- `.js` = ドメイン/データ、`.jsx` = UI（app）／`packages/ui` は `.ts`/`.tsx`

## やりたいこと → 触る場所

| やりたいこと | 場所 |
|---|---|
| 単語/英英/例文/グロス/物語を追加・編集 | `content/*.ndjson` `content/stories/*.json`（正準ソース）。**生成物 `src/content/{wordsData,dictionaryData,dictMeta,wordGlossData,wordRubyData}.js` `wordSentences/{L1..L4,theme,wsentCounts}.js` `stories/*.js` は触らない**（`npm run content:build`） |
| ラベル/モード/終了条件の定義 | `src/content/{modes,endConditions,learningModes,keyboard,romaji,words,dictionary,story}.js`（手書き） |
| 打鍵判定・ローマ字の受理 | `src/domain/romaji/{romaji,input,drill}.service.js`、`packages/core/src/romaji/` |
| 入力進捗・漢字アライメント | `src/domain/typing/{progress,units,expectedKey}.service.js`、`packages/core/src/typing/progress.service.js` |
| 出題の並び・穴埋め・範囲(復習) | `src/domain/session/learningSequence.service.js`、`src/domain/typing/cloze.service.js`、`src/domain/words/wordRange.service.js` |
| 出題セット生成 | `src/domain/words/{wordset,wsentSet}.service.js`、`src/domain/dictionary/dictset.service.js`、`src/domain/marathon/passage.service.js`、`src/domain/touch/drill.service.js`、`src/domain/story/{navigation,flowProgress}.service.js` |
| 採点・速度・セグメント統計 | `src/domain/marathon/scoring.service.js`、`src/domain/records/{sessionResult,segmentStats}.service.js` |
| ランキング・記録キー・スコア | `src/domain/records/{ranking.service,rankingBoard.aggregate,recordKeys.service,score.vo,scoreRecord.vo,itemStat.entity}.js` |
| 終了条件（時間/文字数/問題数/サドンデス） | `src/domain/session/endCondition.vo.js`、`src/content/endConditions.js` |
| **対戦の勝敗ルール・状態遷移** | `src/domain/versus/*.service.js`（`suddenDeath` `matchState` `matchScore` `approvalState` `waitingState` `progressWire` `boardMirror` `startClock` 等）、`matchConfig.vo.js` |
| 対戦の進行・画面 | `src/application/versus/{useVersus.js,versusPlay.policy.js,versusSession.store.js}`、`src/ui/versus/Versus{Connect,Lobby,Match}.container.jsx` |
| 対戦の通信（WebRTC/シグナリング） | `src/infrastructure/p2p/{webrtcPeer,manualSignaling}.adapter.js`、`iceConfig.repository.js` |
| ゲーム進行の状態機械 | `src/application/use{Marathon,Story,Words,WordQuiz,Dict,DictQuiz,Touch,Romaji}.js` |
| **記録の保存先・読み書き** | `src/application/records.service.js`（ファサード）、`records/recordFinishedSession.service.js`、`src/application/persist/*.policy.js`（純ロジック）、`src/infrastructure/db/repos/*.repository.js`（DB I/O） |
| DB スキーマ・マイグレーション | `src/infrastructure/db/{applySchema.schema,migrations.migration,runMigrations.adapter,sqliteWorker.adapter,initStorage.adapter}.js` |
| バックアップ/復元・多タブ協調 | `src/application/{backup,externalBackup,recovery}.service.js`、`src/infrastructure/persist/*.adapter.js` |
| PWA（SW/オフライン/インストール） | `src/infrastructure/pwa/*.adapter.js`、`src/ui/pwa/`（バナー系 container ＋ `use*.js`） |
| 効果音 | `src/infrastructure/{sound.adapter,soundSettings.repository}.js`、`src/ui/sound/` |
| 画面ルーティング・phase/gameType | `src/App.jsx`、`src/application/{routing,recordDetailRoute}.policy.js` |
| メニュー項目の可否 | `src/application/appMenu.policy.js`、`src/ui/menu/AppMenuBar.container.jsx` |
| 準備画面 / 結果・記録画面 | `src/ui/ready/*.container.jsx` / `src/ui/result/`・`src/ui/records/` |
| **見た目・CSS** | `packages/ui/src/styles/*.css`（部品）、`src/App.css`（トークン/全体） |
| 純粋描画の部品そのもの | `packages/ui/src/**/*.presenter.tsx`（変更後 `npm run build:pkgs`） |

## 新しいファイルを置くとき（`src/domain/_ddd-naming.test.js` が強制）

basename が **許可サフィックス + 拡張子** で終わらないと `check:fast` が赤になる。

| ツリー | 拡張子 | 許可サフィックス |
|---|---|---|
| `src/domain`, `packages/core/src` | `.js` | `entity` `aggregate` `vo` `factory` `event` `specification` `repository` `service` |
| `src/application` | `.js` | `service` `policy` `store` |
| `src/infrastructure` | `.js` | `repository` `adapter` `migration` `schema` `mapper` |
| `src/ui` | `.jsx` | `container` `presenter` `context` |
| `packages/ui/src` | `.tsx` / `.ts` | `presenter` / `util` |

除外：`*.test.*`・`*.d.ts`・`index.js`/`index.ts`・`src/application`と`src/ui`の `use*`（React フック）・`*.stories.tsx`。

テストは対象と同ディレクトリに colocate。ステレオタイプ共通の契約テストは `src/test/contracts/` を再利用する。
