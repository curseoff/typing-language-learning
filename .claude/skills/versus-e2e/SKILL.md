---
name: versus-e2e
description: 対戦（サドンデス）の決着ルールを Chrome 2 個の実挙動で 1 コマンド検証する。決着・勝敗・脱落まわり（suddenDeath / VersusMatch / useVersus / P2P 進捗配信）を触ったとき、#443 系の回帰確認に使うときに読む。
---

# 対戦サドンデス 2 ブラウザ E2E

`scripts/versus-e2e.mjs` が Chrome を **2 プロセス**起動し、接続コードの往復・ロビー合意・打鍵まで自動で行い、**両方のブラウザで決着が同じに見えること**を検証する。

片側だけ `finished` になる／片側だけ `ongoing` のまま、という非対称の不具合（#443 の `09fd4da` で直したもの）を捕まえるのが主目的なので、**必ず両者の snapshot を見る**という設計になっている。

## 前提

- **dev サーバが別ターミナルで動いていること**。このスクリプトは再利用するだけで、自前では起動しない。
- **本人の dev サーバを絶対に落とさない**。`pkill -f vite` の類は実行しないこと。
- Chrome はシステムのものを使う（`puppeteer-core` 同梱なし）。見つからなければ `CHROME_PATH` を設定する。
- DEV ビルド限定。フック `window.__tllVersus` は `import.meta.env.DEV` の内側だけに存在し、本番バンドルには文字列すら残らない。

## 使い方

```bash
# 別ターミナルで
npm run dev

# 全シナリオ（約 6〜7 分）
npm run versus:e2e -- --scenario all

# 1 シナリオだけ・目で見ながら
npm run versus:e2e -- --scenario a-eliminated-b-ahead --headful

# Chrome の場所を指定する場合
CHROME_PATH=/path/to/chrome npm run versus:e2e -- --scenario draw

# 手で試したいだけ（接続の往復だけ自動・ロビーで停止）
npm run versus:e2e -- --setup-only
```

| オプション | 意味 |
|---|---|
| `--scenario <name\|all>` | 走らせるシナリオ（`--setup-only` のときは不要・併用不可） |
| `--setup-only` | 接続だけ自動でやってロビーで停止する（手動検証モード・下記） |
| `--base <url>` | dev サーバ（既定 `http://localhost:5173`） |
| `--lives <n>` | サドンデスのライフ（既定 3） |
| `--headful` | ブラウザを表示する |
| `--keep-open` | **シナリオ完走後**にブラウザを残す（`--setup-only` とは目的が違う） |
| `--window-size <WxH>` | `--setup-only` のウィンドウサイズ（既定 `960x1000`） |
| `--timeout <ms>` | 各待ちの期限（既定 60000） |

終了コードは 成功 0 / 失敗 1。失敗時は `tmp/versus-e2e/<scenario>-{host,guest}.png` にスクショを保存し、両者の `snapshot()` を標準出力へダンプする。

## 手で検証したいとき（`--setup-only`）

自動シナリオでは作れない局面を**自分で打って**確かめたいことがある。面倒なのは接続の往復（役割選択 → 接続コード生成 → 貼付 → 応答コード → 貼付）だけなので、そこまでを自動化してロビーで止める。

```bash
npm run versus:e2e -- --setup-only
npm run versus:e2e -- --setup-only --window-size 800x900   # 画面が狭いとき
```

| 項目 | 挙動 |
|---|---|
| 表示 | 常に headful（`--headful` の指定は不要） |
| 配置 | 2 ウィンドウを**左右に並べる**（左＝ホスト／右＝ゲスト）。重ならないよう 1 枚目の実位置を測って隣に置く |
| 停止位置 | **ロビー（対戦条件の選択）**。種目・レベル・終了条件には**一切触れない**ので自分で選ぶ |
| 終了 | **Enter**／**Ctrl-C**／**Chrome のウィンドウを自分で閉じる** のどれでも可（下記）。それまで開いたまま保持 |

終了手段は 3 つあり、どれを使っても**ブラウザ 2 つとも閉じて** node も抜ける（#452）。

| 手段 | 何が起きるか |
|---|---|
| ターミナルで **Enter** | 待ちを解いて 2 つとも `browser.close()` する（`stdin` が対話端末のときだけ受け付ける） |
| ターミナルで **Ctrl-C** | **puppeteer 既定のシグナルハンドラ**が同期で 2 つとも SIGKILL する |
| **ウィンドウを自分で閉じる** | 片方の `disconnected` を検知して残りも閉じ、node も終了する |

Ctrl-C は「フォアグラウンドの**プロセスグループ全体**への SIGINT」なので、`npm run` 経由だと npm が先に落ちて node も巻き添えで死ぬ。だから**自前の非同期な後始末に頼ってはいけない**（走り切らずに Chrome が取り残される）。puppeteer の既定ハンドラは同期で Chrome のプロセスグループを SIGKILL するため、これに任せるのが正解＝`handleSIGINT`/`handleSIGTERM`/`handleSIGHUP` を `false` にしないこと。

> 動作確認のために SIGINT を送るときは `kill -INT <node の PID>` ではなく **`kill -INT -<PGID>`（プロセスグループ宛て）**にする。前者は実際の Ctrl-C と挙動が違い、不具合を見逃す。

対戦中の判定状態は、どちらのウィンドウでも DevTools の Console から読める。

```js
window.__tllVersus.snapshot()
// { selfId, isHost, phase, endKind, initialLives,
//   self:{lives, correct, typed, mistakes}, others:[{id,lives,correct,hasProgress}], outcome }
```

おかしな挙動を見つけたら、**両方のウィンドウで** `snapshot()` を実行した結果を控える（片側だけ `finished`／値が食い違う、が一次情報になる）。サドンデスを見たいならロビーで「終了条件＝サドンデス」を選ぶこと。

ブラウザは 2 プロセス・別プロファイル（まっさら）で起動する。同一プロファイルの副タブだと「保存されません」バッジが出るため、素の状態で試せるこちらを既定にしている。

## シナリオ

A=ホスト・B=ゲスト。種目 `words`・L1・終了条件サドンデス（`--lives`）で合意してから進行する。

| name | 作る局面 | 期待 |
|---|---|---|
| `a-eliminated-b-ahead` | A のライフ 0 ＋ B の正解数 > A | B の勝利で終了 |
| `a-eliminated-b-behind` | A のライフ 0 だが B の正解数 ≦ A | **終了しない**（3 秒間 running + ongoing を維持） |
| `both-eliminated` | A 脱落後に B も脱落・正解数に差 | 多い側の勝利で終了 |
| `draw` | 全員脱落かつ正解数同点 | `draw` で終了 |
| `host-eliminated` | 脱落するのがホスト側 | 両タブで決着（`09fd4da` の回帰確認） |

`a-eliminated-b-behind` は「早すぎる決着が起きないこと」を見る負のシナリオなので、他が緑でもこれだけ落ちたら**決着条件が緩すぎる**ということ。

## 仕組み（読むとき用）

局面は **実キーストローク**で作る。DEV フックは読み取り専用で、判定・P2P 配信・ホスト権威ロジックを一切迂回しない＝不具合の本丸をそのまま通す。

- `window.__tllVersus.snapshot()` → `{ selfId, isHost, phase, endKind, initialLives, self:{lives,correct,typed,mistakes}, others:[{id,lives,correct,hasProgress}], outcome }`
  - `self` は derived の権威値を読む（`progress[selfId]` を読むと `09fd4da` で直した二重ソース非対称が再発する）。
  - `outcome` は `src/domain/versus/suddenDeath.service.js` の `suddenDeathOutcome` の返り値そのまま。`status` は `'won'` / `'draw'` / `'ongoing'`（`winnerId` は `won` のときだけ）。**語彙はこの正本ファイルを参照する。**
- `nextKey()` / `wrongKey()` → 打てば正解になる 1 キー／必ずミスになる 1 キー。中身は純ドメイン `src/domain/typing/expectedKey.service.js`（既存 `acceptsRomaji` を再利用・新しいローマ字表は作っていない）。

**フックは PlayArea がマウントされている間だけ存在する**。接続 / ロビー / 承認 / カウントダウン中は `window.__tllVersus` が `undefined` なので、ポーリングで待つ必要がある（ドライバ側で対応済み）。

## 落ちたときの切り分け

1. スクショを見る。接続やロビーで止まっていれば **ドライバのセレクタ**の問題（UI を変えた？）。
2. 対戦画面まで進んでいれば、ダンプされた両者の snapshot を突き合わせる。
   - 片側だけ `finished` ／ 片側だけ `ongoing` → **本体の不具合**（権威・配信の非対称）。
   - 両者の `self`/`others` の値が食い違う → **進捗配信**の問題。
   - 値は合っているのに `outcome` が期待と違う → **判定ロジック**（`suddenDeath.service.js`）の問題。単体テストで再現できるはずなので、まず `suddenDeath.service.test.js` にケースを足す。
3. 本体の不具合と判断したら、勝手に直さず事実として報告する（TDD 対象＝test-author の Red が先）。

## 注意

- ローカル専用。実行時間が長い（1 シナリオ 60〜90 秒）ので CI には組み込んでいない。
- 検証の書き足しはシナリオ単位で `SCENARIOS` に追加する。打鍵は `answerCorrect`（1 問正解しきる）と `eliminate`（ライフを 0 にする）などのヘルパの組み合わせで書く。
- 脱落者の `correct` は必ず `lives - 1` になる（脱落後は凍結され伸びない）。シナリオで正解数の大小を作るときはこれが基準。
