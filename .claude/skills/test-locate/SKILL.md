---
name: test-locate
description: 機能名から「その振る舞いを検証しているテスト」を引く索引。「この挙動のテストはどこ？」となったとき、新しいテストをどこに置くか迷ったとき、テスト実行を1ファイルやパターンに絞りたいときに読む。
---

# テスト索引（機能名 → 見るテスト）

**これは「どこで検証しているか」の索引**。「どこを直すか」は `repo-map` スキル、ファイル名の接尾辞は `ddd-naming` スキル。ここでは重複させない。

## 大前提

- **テストは実装と同ディレクトリに colocate**（`foo.service.js` の隣に `foo.service.test.js` / `foo.test.js`）。専用の `__tests__` や `test/` ツリーは無い（例外は共通契約の `src/test/contracts/` と `src/test/setup.js`）。
- vitest の収集範囲は `vite.config.js` の `include`：**`src/**/*.test.{js,jsx}` と `packages/*/src/**/*.test.{ts,tsx}` だけ**。
  - → **`packages/core` に `.js` のテストを置いても実行されない**（`.ts` なら拾う。実在するのは `packages/core/src/romaji/kanaTable.contract.test.ts` の 1 本だけ）。`@tll/core` の中身は `src/domain` 側の薄板（re-export）越しにテストしている（例：`src/domain/romaji/romaji.service.js` は `@tll/core` を再エクスポートするだけで、実質の仕様テストは `src/domain/romaji/romaji.test.js`）。
- 既定環境は **node**。UI/ブラウザ API に触るテストは**ファイル先頭に `// @vitest-environment jsdom`** を書く（`environmentMatchGlobs` は vitest 4 で廃止）。現状 101 本が jsdom 指定。
- 本数の目安（`src` + `packages`）＝約 201 本：`src/domain` 62 / `src/application` 57 / `src/infrastructure` 21 / `src/ui` 20 / `src/content` 3 / `packages/ui/src` 37 / `packages/core/src` 1。

## 機能軸 → 見るテスト

### ローマ字・かな変換・打鍵判定

| 見たい振る舞い | テスト |
|---|---|
| かな→ローマ字候補・`kanaConsumed` | `src/domain/romaji/romaji.test.js` |
| 打鍵の受理/不受理（入力状態機械） | `src/domain/romaji/input.test.js` |
| ローマ字練習の出題 | `src/domain/romaji/drill.test.js` |
| かなテーブルそのもの | `src/domain/romaji/kanaTable.test.js`、`packages/core/src/romaji/kanaTable.contract.test.ts` |
| 入力進捗・ルビ整列（`alignJaToKana` / `rubyParts` / `kanjiDone`） | `src/domain/typing/progress.test.js` |
| 打鍵単位の分割 | `src/domain/typing/units.test.js`、`src/domain/typing/units.edge.test.js`（端ケース） |
| 「次に打てば正解のキー」「必ずミスになるキー」 | `src/domain/typing/expectedKey.service.test.js` |
| 穴埋め（cloze）の生成 | `src/domain/typing/cloze.service.test.js` |

### 出題セット・セッション進行

| 見たい振る舞い | テスト |
|---|---|
| 単語の出題セット・固定範囲(range) | `src/domain/words/wordset.test.js`、`src/domain/words/wordRange.service.test.js` |
| 単語例文の出題セット | `src/domain/words/wsentSet.test.js` |
| 英英の出題セット | `src/domain/dictionary/dictset.test.js` |
| マラソンの本文組み立て・採点 | `src/domain/marathon/passage.test.js`、`src/domain/marathon/scoring.test.js` |
| タッチタイピング練習の出題 | `src/domain/touch/drill.test.js` |
| 物語の進行・フロー進捗 | `src/domain/story/navigation.test.js`、`src/domain/story/flowProgress.test.js` |
| 学習順序（新規/復習の並び） | `src/domain/session/learningSequence.service.test.js` |
| 終了条件（時間/文字数/問題数/サドンデス） | `src/domain/session/endCondition.test.js`、`src/content/endConditions.test.js` |
| 進捗 VO（keys/mistakes/items/elapsed） | `src/domain/session/progress.test.js` |
| セッションの集約・生成 | `src/domain/session/typingSession.test.js`、`src/domain/session/typingSessionFactory.test.js` |
| 乱数（決定的 seed） | `src/domain/rng.test.js`、`src/domain/rng.service.test.js`、`src/application/seed.test.js` |

### プレイのフック（1 プレイ完走の結合テスト）

`src/application/use*.test.js` が手本。`renderHook` ＋ `act()` の中で `window.dispatchEvent(new KeyboardEvent('keydown', {key}))` を送って完走させ、`record` と `segStats` を検証する（全て jsdom）。

| モード | テスト |
|---|---|
| 単語入力 | `src/application/useWords.test.js`（+ `.items` `.cloze` `.life` `.saveRecord`） |
| 単語クイズ | `src/application/useWordQuiz.test.js`、`useWordQuiz.items.test.js` |
| 英英入力 | `src/application/useDict.test.js`（+ `.cloze` `.saveRecord`） |
| 英英クイズ | `src/application/useDictQuiz.test.js` |
| マラソン | `src/application/useMarathon.test.js`（+ `.items` `.cloze`） |
| 物語 | `src/application/useStory.test.js` |
| タッチ練習 | `src/application/useTouch.test.js` |
| ローマ字練習 | `src/application/useRomaji.test.js` |
| カウントダウン | `src/application/useCountdownTimer.test.js` |
| 全フック横断（打鍵ごとの進捗通知） | `src/application/onProgress.integration.test.js` |
| 全フック横断（マウント即計時開始） | `src/application/autoStart.integration.test.js` |
| ミス時の効果音発火 | `src/application/missSound.integration.test.js` |
| 問題ごとの記録（segStats / itemStats） | `src/application/segTracker.test.js`、`src/application/itemTracker.test.js`、`src/application/quizSegStat.test.js` |

### 対戦（versus）

| 見たい振る舞い | テスト |
|---|---|
| サドンデスの勝敗判定 | `src/domain/versus/suddenDeath.service.test.js` |
| 盤面がキー入力を受けてよいか | `src/domain/versus/boardActivity.service.test.js` |
| マッチの状態遷移・スコア | `src/domain/versus/matchState.service.test.js`、`src/domain/versus/matchScore.service.test.js` |
| 合意/待機/開始時刻 | `src/domain/versus/approvalState.service.test.js`、`waitingState.service.test.js`、`startClock.service.test.js` |
| 相手盤面の複製・カーソル・伏字 | `src/domain/versus/boardMirror.service.test.js`、`mirrorCursor.service.test.js`、`progressMask.service.test.js` |
| 進捗のワイヤ形式・メッセージ VO | `src/domain/versus/progressWire.service.test.js`、`versusMessage.vo.test.js` |
| 対戦設定 VO・教材の一致確認・参加者名簿 | `src/domain/versus/matchConfig.vo.test.js`、`contentFingerprint.service.test.js`、`peerRoster.service.test.js` |
| 対戦時のプレイ方針・問題列の再構成・セッション状態 | `src/application/versus/versusPlay.policy.test.js`、`versusSegments.policy.test.js`、`versusSession.store.test.js` |
| シグナリングのコーデック・ICE 設定 | `src/infrastructure/p2p/manualSignaling.adapter.test.js`、`iceConfig.repository.test.js` |
| 対戦画面の描画 | `packages/ui/src/versus/*.test.tsx`（`VersusBoardView` `ProgressCardView` `MaskBoard` `MirrorPlayView` `PlayMirrorView` `MatchApprovalView` `SignalingExchangeView`） |

**`src/ui/versus/*.container.jsx` には単体テストが無い**（RTCPeerConnection 配線でカバレッジ除外。`vite.config.js` の exclude 参照）。実挙動は `npm run versus:e2e`（Chrome 2 枚）と pwa-verifier で担保する。

### 記録・ランキング・スコア

| 見たい振る舞い | テスト |
|---|---|
| セッション結果の組み立て・区間統計 | `src/domain/records/sessionResult.test.js`、`segmentStats.test.js` |
| ランキング・記録キー・スコア VO | `src/domain/records/ranking.test.js`、`rankingBoard.test.js`、`recordKeys.test.js`、`score.test.js`、`scoreRecord.test.js` |
| 記録の絞り込み条件・項目統計 | `src/domain/records/recordSpecs.test.js`、`itemStat.test.js` |
| リポジトリ IF | `src/domain/records/rankingRepository.test.js` |
| 記録保存のユースケース | `src/application/records/recordFinishedSession.test.js` |
| ファサード（読み書きの入口） | `src/application/records.test.js`（+ `.memory` `.persist` `.multitab`） |
| 全記録横断ビュー | `src/application/allRecords.test.js`、`src/ui/records/AllRecordsView.test.jsx`、`packages/ui/src/records/AllRecordsView.test.tsx` |
| 記録詳細への遷移 | `src/application/recordDetailRoute.policy.test.js`、`src/ui/result/RecordDetail.test.jsx` |
| エンドレスのランキング表示 | `src/ui/result/endlessRanking.test.jsx` |

### 永続化（DB / バックアップ / 多タブ）

| 見たい振る舞い | テスト |
|---|---|
| メモリ像への適用（純ロジック） | `src/application/persist/memoryStore.test.js` |
| 書き込みキュー | `src/application/persist/writeQueue.test.js`、`writeQueueFlush.test.js` |
| バックエンド選択・主タブ選出・副タブ通知 | `src/application/persist/backend.test.js`、`election.test.js`、`secondaryMessage.test.js` |
| 破損検知と復元の判断 | `src/application/persist/recovery.test.js`（判断の純関数）、`src/application/recovery.wiring.test.js`（配線） |
| 外部フォルダ自動バックアップ | `src/application/persist/externalBackup.test.js` |
| 手動 export/import | `src/application/backup.test.js`（純関数）、`backup.wiring.test.js`（配線）、`backupHumanize.test.js` |
| 保存状態バッジ・告知 | `src/application/persist/saveStatus.store.test.js`、`saveStatusBadge.policy.test.js`、`persistNotice.test.js` |
| 永続化許可の判定 | `src/domain/persist/permission.test.js` |
| DB スキーマ移行 | `src/infrastructure/db/runMigrations.test.js` |
| 各リポジトリの往復 | `src/infrastructure/db/repos/{recordsDb,wordsDb,dictDb,storyDb,itemStatsDb}.test.js`、`fieldCoverage.test.js` |

### PWA / オフライン / 効果音

| 見たい振る舞い | テスト |
|---|---|
| SW 登録・precache 一覧・オンライン検知・インストール導線 | `src/infrastructure/pwa/{registerSW,precache,onlineStatus,installPrompt}.test.js` |
| フックと UI | `src/ui/pwa/{useOnlineStatus,useInstallPrompt}.test.js`、`{OfflineBanner,UpdateToast,ContentFallbackNotice}.test.jsx` |
| 教材の SQLite→.js フォールバック | `src/content/contentFallback.test.js`、`src/infrastructure/observability/contentFallbackStore.test.js` |
| 効果音 | `src/infrastructure/sound.test.js`、`soundSettingsRepository.test.js`、`src/ui/sound/SoundToggle.test.jsx`、`packages/ui/src/sound/SoundToggle.test.tsx` |

### ルーティング・メニュー・画面

| 見たい振る舞い | テスト |
|---|---|
| URL ↔ 状態の codec（純関数） | `src/application/routing.policy.test.js` |
| App の配線（初期化・pushState・popstate） | `src/ui/App.routing.test.jsx` |
| 全モードが白画面にならないか | `src/ui/App.smoke.test.jsx` |
| 固定範囲プレイの開始配線 | `src/ui/App.range.test.jsx`、`src/application/headwordFreqSlice.policy.test.js` |
| メニュー項目の可否 | `src/application/appMenu.test.js`、`packages/ui/src/menu/MenuBarView.test.tsx` |
| 準備画面の各セクション | `src/ui/ready/{WordsSection,DictSection,WordSentenceSection}.test.jsx`、`packages/ui/src/ready/*.test.tsx` |
| 純粋描画の部品 | `packages/ui/src/**/*.test.tsx`（`shared/Flow` `shared/Text` `marathon/TopFlow` `result/*` `touch/*` ほか） |
| ティッカーのフェード計算 | `src/ui/shared/tickerMask.test.js`（app 側）、`packages/ui/src/util.contract.test.tsx`（`shared/tickerMask.util.ts` を契約で被覆） |
| イベントバス・ドメインイベント | `src/application/events/eventBus.test.js`、`src/domain/events/recordEvents.test.js` |

### 教材データ（コンテンツ）

- **教材データ本体の検証は vitest ではなく `npm run validate`**（`scripts/content-validate.mjs` ＝ NDJSON の構造/型/一意性、`scripts/validate-sentences.mjs` ＝ dict⊆words・`jaWords` 連結＝`ja`・全 kana が打鍵可 などの意味検証）。読みの落とし穴は `content-rules` スキル。
- vitest 側にあるのは `src/content/{story,endConditions,contentFallback}.test.js` の 3 本だけ（教材レコードそのものではなくヘルパ/購読機構）。

## テストの種類 → 置き場所

| 種類 | 置く場所 | 例 |
|---|---|---|
| 純ロジックの単体テスト | 実装の**隣**（同ディレクトリ） | `src/domain/versus/suddenDeath.service.test.js` |
| ステレオタイプ共通契約 | 各層直下の `*.contract.test.js` に**手で登録**（自動検出ではない）。共通アサーションは `src/test/contracts/` を再利用 | `src/domain/valueObject.contract.test.js`、`src/application/store.contract.test.js`、`src/infrastructure/adapter.contract.test.js`、`src/ui/presenter.contract.test.jsx` |
| フックの結合テスト | `src/application/use*.test.js` に足す（jsdom ＋ KeyboardEvent 完走） | `src/application/useWords.test.js` |
| container の配線テスト | `src/ui/**/*.test.jsx`（jsdom） | `src/ui/ready/WordsSection.test.jsx` |
| 純粋 presenter の smoke | `packages/ui/src/**/*.test.tsx`（jsdom・代表 props で描画確認） | `packages/ui/src/result/Result.test.tsx` |
| ファイル名規約のメタテスト | 追加不要（`src/domain/_ddd-naming.test.js` が全ツリーを走査） | — |
| ブラウザ実挙動（E2E 相当） | vitest に載せない。`scripts/*.mjs` のドライバ | 下記 |

契約テスト一覧（実在）：`src/domain/{entity,aggregate,valueObject,factory,domainEvent,domainService,repository,specification}.contract.test.js` / `src/application/{applicationService,policy,store}.contract.test.js` / `src/infrastructure/{adapter,mapper}.contract.test.js`・`db/{migration,schema}.contract.test.js`・`db/repos/repository.contract.test.js` / `src/ui/{container,presenter}.contract.test.jsx`・`result/context.contract.test.jsx` / `packages/ui/src/util.contract.test.tsx` / `packages/core/src/romaji/kanaTable.contract.test.ts`。

**新しく `*.vo.js` や `*.store.js` を足したら、対応する契約テストに登録するか、載せない理由をそのテスト冒頭のコメントに書く**（既存が手本）。

## vitest が実行しないテスト（探しても `npm test` に出てこない）

| 何 | 実行 |
|---|---|
| 稼働台帳の pure core（`scripts/team-ledger.test.mjs`） | `npm run team:test`（`node --test`。vitest の include 外＝`.mjs` かつ `scripts/`） |
| 教材データの整合性 | `npm run validate` |
| 生成 SQLite と .js の一致 | `npm run check:content` |
| 初回バンドル予算（512KB） | `npm run check-bundle` |
| PWA 実挙動（SW/キャッシュ配分） | `npm run build && npm run check:pwa`（ヘッドレス Chrome・ローカル専用/CI 非組込） |
| 対戦の決着（Chrome 2 枚） | `npm run versus:e2e -- --scenario all`（要 `npm run dev` 起動済み・ローカル専用） |
| 画面キャプチャ | `npm run screenshots` / `npm run shots:play` |

## 実行の絞り込み

```bash
npx vitest run src/domain/versus/suddenDeath.service.test.js  # 単一ファイル
npx vitest run suddenDeath                                    # パス部分一致（複数ヒット可）
npx vitest run src/application/versus                         # ディレクトリ配下
npx vitest run useWords -t "サドンデス"                        # テスト名でさらに絞る（-t）
npm run test:watch -- suddenDeath                             # watch（vitest 素の watch）
npm test                                                      # 全件（= vitest run）
npm run coverage                                              # 全件 + カバレッジ（閾値ゲート付き）
```

- `pretest` / `precoverage` で **`content:build` が毎回走る**（生成物 `src/content/*Data.js` 等を作る）。`npx vitest` を直接叩くとこれが走らないので、生成物が無い/古いクリーン環境では先に `npm run content:build`。
- カバレッジ閾値は `vite.config.js` の `thresholds`（up-only のラチェット）。テストを足したら **full `npm run check` を 1 回**回して実測を見て、実測の少し下へ引き上げる。
