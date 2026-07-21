---
name: shots
description: UI を実画面で目視確認するための撮影手順。shots:play / screenshots が何をどこに撮るか、dev 限定の ?preview= に指定できる値（result/play/story/touch/romaji/versus 他）、出力先 /tmp/app-shots、撮れない状態の線引きと失敗時の対処。スクショを撮りたい・レイアウト崩れやはみ出しを見たいときに読む。本人の dev は絶対に落とさない。
---

# UI の目視確認（スクリーンショット）

## 最重要：本人の dev サーバを絶対に落とさない

**`pkill -f vite` / `killall node` の類は実行禁止**。本人が別ターミナルで動かしている dev（既定 `http://localhost:5173`）を巻き添えにする。プロセスを止める必要が出たら、**必ずポートから PID を特定して 1 つだけ**落とす。

```bash
# 動いている dev を確認する（reachable なら再利用する）
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:5173/   # 200 なら生きている
lsof -nP -iTCP:5173 -sTCP:LISTEN                                    # 誰が握っているか

# どうしても止める必要があるとき（そのポートの PID だけ）
lsof -ti tcp:5191 | xargs -r kill
```

dev が動いていなかった場合の選択肢は次の順で考える。

1. **`npm run shots:play` をそのまま使う** — このスクリプトは**自前で別ポート（既定 5191）の dev を起動して終了時に落とす**ので、本人の 5173 には触らない。これが既定の手段。
2. 自分で起動したいときは **必ず別ポート**（`--port 5191` 等・`--strictPort`）で立て、自分で起動したプロセスだけを落とす。
3. 本人の dev が要る場面（作業中の状態をそのまま見たい等）は、**起動を本人に依頼**する。勝手に再起動しない。

## スクリプト一覧

| コマンド | 実体 | 対象 | 前提 | 出力 |
|---|---|---|---|---|
| `npm run shots:play` | `scripts/shots-play.mjs` | **dev** サーバに `?preview=result` / `?preview=play` | 自前で `npm run dev --port 5191 --strictPort` を起動→終了時に kill（既存 dev は不要） | `/tmp/app-shots/result.png` `play.png`（1200×1400） |
| `npm run screenshots` | `scripts/screenshots.mjs` | **production preview** の各タブ TOP（`?tab=`） | 既定で `npm run build` してから `vite preview --port 4188` を起動→終了時に kill | `/tmp/app-shots/<tab>.png`（1200×900）＋ `contact.png`（一覧・1280×1700） |

共通オプション（どちらも同じ書式）。

```bash
npm run shots:play    -- --port 5191 --dir /tmp/app-shots
npm run screenshots   -- --no-build --port 4188 --dir /tmp/app-shots
CHROME="/path/to/chrome" npm run shots:play   # 既定は /Applications/Google Chrome.app/...
```

- `--no-build` は `screenshots` のみ（既存 `dist` を使い回す＝速い）。
- Chrome は**システムの Chrome をヘッドレスで直起動**（`--headless=new --hide-scrollbars --disable-gpu --screenshot=...`）。見つからなければ `CHROME` 環境変数で指定する。
- 描画待ちは `--virtual-time-budget`（`screenshots` 3500ms / `shots:play` 5000ms）。遅延ロードのチャンクが重い画面はここが効く。

`screenshots` が撮るタブは `wsent`（単語例文）/ `words`（単語）/ `dict`（英英辞典）/ `story`（物語）/ `touch`（タッチタイピング）の 5 つ（`romaji` は含まれていない）。

## `?preview=` に指定できる値（**dev 限定**）

`src/App.jsx` の DEV 専用 effect（`import.meta.env.DEV` ガードの内側）が受け口。**本番ビルドでは無効**なので `vite preview` や公開ページでは効かない。

| 値 | 出る画面 |
|---|---|
| `result` | 結果画面をダミーデータで表示（問題ごとの記録 3 行＋ランキング＋リプレイ。`seed` 固定・過去の記録 1 件入り） |
| `play` | 単語例文プレイを即開始（フロー表示のティッカー） |
| `touch` | タッチタイピング即プレイ。`&mode=hard` で「むずかしい」（既定 easy） |
| `romaji` | ローマ字入力即プレイ（かな表確認用）。`&level=<key>` で出題行を指定 |
| `story` | 物語（通常の開始状態） |
| `story-choice` | 物語の**選択肢場面**（段組みフローの確認用） |
| `versus` | 対戦の接続コード交換（#426。**現状 dev のこの経路からしか到達できない**） |
| `versus-lobby` | 対戦ロビー＝設定→提案（#432。同上） |

`level` に使えるキー（`src/content/romaji.js` の `ROMAJI_LEVELS`）：
`a` `ka` `sa` `ta` `na` `ha` `ma` `ya` `ra` `wa`（わ行・ん）`daku`（濁音）`handaku`（半濁音）`youon`（拗音）`all`（ぜんぶ）。無効値は無視されて既定のまま。

例（本人の dev = 5173 を**読むだけ**なら安全）。

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --hide-scrollbars --disable-gpu --window-size=1200,1400 \
  --virtual-time-budget=5000 \
  --screenshot=/tmp/app-shots/story-choice.png \
  'http://localhost:5173/?preview=story-choice'
```

## その他の URL パラメータ

- `?tab=<story|words|wsent|dict|touch|romaji>` … **旧共有リンクの後方互換シム**。base 直下のときだけ拾い、対応する slug へ変換する（`wsent` → `/sentences`、他は同名）。現行は**パスが正**なので、`/sentences` `/words` `/dict` `/story` `/touch` `/romaji` を直接開いてもよい。
- `?persist=<sqlite|memory>` … 永続バックエンド指定（`src/main.jsx`）。`memory` で記録を残さず撮れる。無効値は既定 `sqlite`。
- `?mode=hard`（`preview=touch` と併用）/ `?level=`（`preview=romaji` と併用）。

## 撮った画像を見る

出力は既定で **`/tmp/app-shots/`**（`--dir` で変更可・リポジトリ内には出さない）。Read ツールで PNG をそのまま開いて目視する。

```bash
ls -l /tmp/app-shots/
```

`screenshots` は個別 PNG を `contact.html` に並べて再撮影したものが `contact.png`。**まず `contact.png` を見て、崩れているタブだけ個別 PNG を開く**のが速い。

## 撮れないもの／向かないもの

- **静的な初期状態しか撮れない**。打鍵途中の着色・ミス表示・キー入力に応じた遷移は `?preview=` では作れない。→ 状態を作る検証は **puppeteer-core でスクリプトを書く**（`scripts/versus-e2e.mjs` / `scripts/check-pwa.mjs` が手本。一時スクリプトはリポジトリ内に残さない）。
- **PWA/オフライン/SW/インストール導線/OPFS の実挙動**は撮影の領分ではない。→ **`pwa-verifier`**（`npm run check:pwa` 系）。
- **対戦の 2 者間の決着**は 1 ブラウザでは再現できない。→ **`versus-e2e` スキル**。
- ヘッドレスは OPFS / Web Locks を満たさないことがあり、その場合 `memory` へ縮退して**保存状態バッジが「非永続」で写る**ことがある。バッジ自体を検証したいのでなければ、これは撮影環境の都合であって不具合ではない。

## よくある失敗と対処

| 症状 | 原因 | 対処 |
|---|---|---|
| `✖ Chrome が見つかりません` | 既定パス `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` に無い | `CHROME=/path/to/chrome npm run shots:play` |
| `dev サーバが起動しませんでした` / `preview が起動しませんでした` | 15 秒（50×300ms／40×300ms）以内に listen しなかった。`--strictPort` なのでポート衝突でも即死 | `--port` を空きポートへ。前回の残骸なら `lsof -ti tcp:5191 \| xargs -r kill`（**`pkill -f vite` は禁止**） |
| 2 回目以降 5191 で必ず失敗する | 終了時 `server.kill()` が npm ラッパーだけを落とし、vite が残ることがある | 同上（ポートから PID 特定して 1 つだけ kill） |
| 初回だけ異様に遅い | `predev`/`prebuild` フックが `content-build` + `content-sqlite` + `gen-miss-sound` を回す | 待つ。`screenshots` は 2 回目以降 `--no-build` |
| 画面が真っ白／中身が出ない | ① `?preview=` を **preview/本番ビルド**に投げている（DEV 限定なので無効）② 遅延ロードのチャンクが `--virtual-time-budget` 内に間に合っていない | ① `shots:play`（dev）を使う ② Chrome を直起動して `--virtual-time-budget` を 8000〜10000 へ延ばす |
| `?tab=` が効かない気がする | `screenshots` は `http://localhost:4188/?tab=...` を開くが preview の base は `/typing-language-learning/`。vite は 302 で base へ飛ばす（**クエリは保持される**ので通常は効く） | 疑わしければ `http://localhost:4188/typing-language-learning/?tab=words` を直接開く |
| 文字が意図と違うフォントで写る | Web フォントは使っておらず**システムフォント**（`index.html` に font の link は無い） | 環境差。フォント読み込み待ちの問題ではない |
| 撮影 PNG が古いまま | 同名で上書きするので、失敗しても前回の画像が残る | `ls -l` で **mtime** を確認してから見る |

## 関連

- 実画面監査そのものは **`ui-auditor`**（read-only・画像を根拠に file:line で報告）。coder は実装後にここへ渡す。
- スクリプト一覧の正本は `docs/DEVELOPMENT.md`。分岐・リリース手順は `git-flow` スキル。
