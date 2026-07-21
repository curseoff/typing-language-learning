---
name: ddd-naming
description: src 配下・packages 配下に新しいファイルを作るときのファイル名サフィックス規約（*.vo.js / *.service.js / *.policy.js / *.container.jsx など）。置き場所から必要な接尾辞を引く表。ファイルを新規追加・リネーム・移動するとき、「命名メタテスト」「DDD ステレオタイプ命名規約」「basename が許可サフィックスで終わる」が赤くなったとき、どの接尾辞を付ければいいか迷ったときに読む。
---

# DDD ステレオタイプ命名規約

`src/domain/_ddd-naming.test.js`（#306/#308 のメタテスト）が**ファイル名の接尾辞**を強制する。basename が「許可サフィックス + 拡張子」で終わらないと `check:fast` が赤になる。**正本はそのテスト**。ここは早見表。

「どこに何があるか」は `repo-map` スキル。

## 置き場所 → 必要な接尾辞

| ツリー | 拡張子 | サフィックス | 意味 | 実例 |
|---|---|---|---|---|
| `src/domain`<br>`packages/core/src` | `.js` | `entity` | 同一性（ID）を持つ | `records/itemStat.entity.js` |
| 〃 | `.js` | `aggregate` | 集約ルート（不変条件の境界） | `records/rankingBoard.aggregate.js` |
| 〃 | `.js` | `vo` | 値オブジェクト（不変・値等価） | `records/score.vo.js`、`session/endCondition.vo.js` |
| 〃 | `.js` | `factory` | 生成の集約 | `session/typingSession.factory.js` |
| 〃 | `.js` | `event` | ドメインイベント | `events/recordEvents.event.js` |
| 〃 | `.js` | `specification` | 述語（合成可能な条件） | `records/recordSpecs.specification.js` |
| 〃 | `.js` | `repository` | 永続の**インターフェース**（実体は infra） | `records/ranking.repository.js` |
| 〃 | `.js` | `service` | ドメインサービス（純粋ロジック） | `romaji/romaji.service.js`、`versus/suddenDeath.service.js` |
| `src/application` | `.js` | `service` | ユースケース・ファサード | `records.service.js` |
| 〃 | `.js` | `policy` | 判断・振り分けの純ロジック | `appMenu.policy.js`、`routing.policy.js` |
| 〃 | `.js` | `store` | module 可変状態 + pub/sub | `persist/saveStatus.store.js` |
| `src/infrastructure` | `.js` | `repository` | 永続の実装（DB/localStorage） | `db/repos/*.repository.js` |
| 〃 | `.js` | `adapter` | 外部 API/ブラウザ API の橋渡し | `sound.adapter.js`、`p2p/webrtcPeer.adapter.js` |
| 〃 | `.js` | `migration` | スキーマ移行 | `db/migrations.migration.js` |
| 〃 | `.js` | `schema` | スキーマ定義・適用 | `db/applySchema.schema.js` |
| 〃 | `.js` | `mapper` | 行 ↔ ドメインの変換 | `db/repos/_codec.mapper.js` |
| `src/ui` | `.jsx` | `container` | 状態と配線（フック呼び出し） | `ready/DictSection.container.jsx` |
| 〃 | `.jsx` | `presenter` | 描画 | `marathon/Passage.presenter.jsx` |
| 〃 | `.jsx` | `context` | React Context | `result/ReplayContext.context.jsx` |
| `packages/ui/src` | `.tsx` | `presenter` | 純粋描画（状態を持たない） | `ready/ItemList.presenter.tsx` |
| `packages/ui/src` | `.ts` | `util` | 純関数ヘルパ | `shared/tickerMask.util.ts` |

**層違いの誤用も落ちる**：`src/application` に `*.adapter.js`、`src/infrastructure` に `*.policy.js` は赤。ツリーごとに許可集合が独立している。

## 規約がかからないもの

- **除外ファイル**：`*.test.*` / `*.d.ts` / `index.js`・`index.ts`（barrel）
- **`use*` フック**：`src/application` の `use*.js`、`src/ui` の `use*.jsx` は対象外（`useMarathon.js` などそのまま）
- **`*.stories.tsx`**（`packages/ui/src`）
- **表に無い拡張子の組み合わせ**：`src/ui` の `.js`（`ui/pwa/useContentFallback.js`、`ui/shared/tickerMask.js` 等）や `src/application` の `.jsx` はツリー定義に無いので列挙されない
- **表に無いツリー**：`src/content`、`src/test`、`src/App.jsx`、`scripts/` など

## 赤くなったときの直し方

- **役割は合っている** → ファイルをリネームして接尾辞を付ける（import 元も追随。`grep -rn "旧ファイル名" src packages`）。
- **接尾辞が付けられない** → 役割か置き場所が間違っている。純ロジックなら `domain`、ブラウザ API 直叩きなら `infrastructure`、React フックなら `use*` に寄せる。テスト側（`_ddd-naming.test.js`）は編集しない。

## サフィックスは契約とセット

`src/test/contracts/` に stereotype ごとの共通契約（`valueObject.js`・`store.js` 等）があり、`*.contract.test.js` から**手動で**呼ばれる（自動検出ではない）。新しく `*.vo.js` や `*.store.js` を足したら、対応する contract test に登録するか、載せない理由をそのテスト冒頭のコメントに書く（既存が手本）。
