# 開発ガイド（DEVELOPMENT）

開発環境・スクリプト・品質チェック・配布・公開について。設計は [ARCHITECTURE.md](ARCHITECTURE.md)、教材データの追加は [CONTENT.md](CONTENT.md) を参照。

## セットアップ

前提: Node.js 18 以上。

```bash
npm install      # 初回のみ
npm run dev      # 開発サーバー起動 → http://localhost:5173
```

ブラウザ（Chrome推奨）で開けば動きます。

## npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | Vite 開発サーバー（HMR） |
| `npm run build` | 本番ビルド（`dist/`） |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run lint` | ESLint（未定義参照・Hooks依存ミス等を検出） |
| `npm run test` | Vitest（ドメインの回帰テスト＋UIスモーク） |
| `npm run validate` | 教材データの整合性チェック（単語・英英・例文） |
| **`npm run check`** | **lint → test → validate → build を一括実行** |
| `npm run screenshots` | 全タブのトップ画面を撮影し1枚に（目視確認用） |

「完了」とする前に **`npm run check`** を通すことを推奨します。

## 品質チェック

- **ESLint**（`eslint.config.js`, Flat config）
  - `eslint-plugin-react` / `react-hooks` を使用。未定義参照（白画面の原因）や `useEffect` 依存ミスを検出
- **Vitest**（`src/**/*.test.{js,jsx}`）
  - ドメイン層（`romaji` / `typing` / `marathon` / `words` / `dictionary` / `records`）の回帰テスト（node 環境）
  - **UIスモーク**（`src/ui/App.smoke.test.jsx`, jsdom 環境）：各モードを開始してプレイ画面が描画されるか（白画面/モード破壊の自動検出）。`vite.config.js` の `environmentMatchGlobs` で `src/ui/**` だけ jsdom。
  - 過去の不具合（漢字↔読みアライメント、600文字で詰む 等）をテストで固定
- **スクリーンショット一覧**（`scripts/screenshots.mjs`）
  - `npm run screenshots` で build → preview → 各タブ（`?tab=` ディープリンク）をヘッドレスChromeで撮影 → `/tmp/app-shots/contact.png` に一覧化。クリックして回る目視確認を1枚に。
  - Chrome のパスは `CHROME=...` で上書き可。既存 dist を使うなら `-- --no-build`。
- **validate**（`scripts/validate-sentences.mjs`）
  - 文・単語・英英の各データを検証（読み→ローマ字変換、重複、レベル/テーマ、文末記号、長音ーの警告 など）

## CI（GitHub Actions）

- `.github/workflows/ci.yml` … `develop` / `master` への push・PR で `npm run check` を自動実行
- `.github/workflows/deploy.yml` … `master` への push で本番（GitHub Pages）へ自動デプロイ

## 公開（GitHub Pages）

- `master` に push されると `deploy.yml` がビルドして公開：
  https://curseoff.github.io/typing-language-learning/
- 初回のみ、リポジトリ **Settings → Pages → Source: GitHub Actions** の設定が必要
- `vite.config.js` は `base: './'`（相対パス）でサブパス配信に対応

## ブランチ運用

`feature/*` → `develop` → `master` の順にPRでマージ。`master` への反映で本番公開されます。

- **リリースPR（→master）の head は `develop` 直接ではなく `release/*` ブランチ**にする（`release/* ← develop` を作って `release/* → master`）。リポジトリは**マージ時 auto-delete** が有効で、develop を head にすると develop ごと削除されるため。
- `Closes #N` は **feature→develop と develop→master の両方**のPR本文に書く（自動クローズは master 到達時のみ発火）。
- マージ後は develop と master を揃え、マージ済みのローカルブランチを削除。develop が消えていたら master と同一内容で再作成して push する。

## リリース版数と GitHub Release

リリースのたびに版数を上げ、GitHub Release を残す。

1. **`package.json` の `version` を上げる**（`vite.config.js` が `__APP_VERSION__` に注入し TOP画面 `v0.10.0` 表示に使う）。理想は release ブランチに含めてタグ対象コミットに版数が入る形。
2. master 反映後、**GitHub Release を作成**（タグ `vX.Y.Z`＝マージコミット）：
   ```bash
   env -u GITHUB_TOKEN gh release create vX.Y.Z \
     --target <フルSHA> --latest \
     --title "vX.Y.Z — 要約" --notes "## ハイライト
   - ..."
   ```
   - `--target` は **40桁のフルSHA**（短縮SHAや位置引数は不可。位置引数はアップロードファイル扱いになる）。
   - ノートは区間コミット（`git log --no-merges 前タグ..今回`）から要約する。

## Git コミット（AI署名）

AI（Claude）が打つコミットは、人間のコミットと**署名・名義を分離**する。離席で 1Password がロックしても失敗しないよう、**1Password非依存のローカル署名鍵**を使う。

```bash
# <氏名>=本人名 / <検証済みメール>=GitHubで検証済みの本人メール / <author用メール>=その +ai 別名（例 name+ai@…）
GIT_COMMITTER_NAME="<氏名> (AI)" GIT_COMMITTER_EMAIL="<検証済みメール>" \
git -c gpg.ssh.program=ssh-keygen -c user.signingkey=~/.ssh/ai-signing.pub \
  commit --author="<氏名> (AI) <author用メール>" -m "..."
```

- **author = `<氏名> (AI) <author用メール(+ai別名)>`**（AI が書いた）、**committer = `<氏名> (AI) <検証済みメール>`**（名前は `(AI)`、メールは検証済み）。
- **committer のメールが検証済み**であることが GitHub の **Verified** の要件。author 側は `+ai` 別名でよい。
- 実値（本人の氏名・メール）はローカルの git 設定／コミットメタデータにのみ置き、ドキュメントには直書きしない。
- 署名鍵 `~/.ssh/ai-signing` はパスフレーズなし。公開鍵は GitHub に **Signing key** として登録済み（Authentication key だと Verified にならない）。
- グローバル/リポジトリの git 設定は変更しない（上書きは `-c` でその場限り）。人間（本人）の `git commit` は従来どおり本人名義・1Password 署名。
- 失敗時（`1Password: failed to fill whole buffer` 等）は、本人コミットなら 1Password のロック解除を待つ。

## Electron（任意・各自ビルド）

デスクトップアプリ版は配布していません。欲しい場合は各自でビルドしてください。

```bash
npm run electron:dev   # ウィンドウで起動（開発用・ホットリロード）
npm run dist:dir       # 動作確認用パッケージを release/ に生成（インストーラ無し）
npm run dist           # インストーラを release/ に生成
```

- 出力形式は実行OSに依存（macOS=`.dmg` / Windows=`.exe` / Linux=`.AppImage`）
- アプリは**未署名**。macOSは初回起動時に警告が出るため `.app` を右クリック →「開く」で回避
- アイコン未設定（既定）。`build/icon.icns`(Mac)/`build/icon.ico`(Win)/`build/icon.png`(Linux) を置くと自動採用
- 記録の保存先（ビルド版）：`~/Library/Application Support/EigoTyping/Local Storage/`

## 記録（localStorage）

記録は種類ごとにキーを分けてブラウザに保存されます。

| 種類 | キー | 単位 |
|---|---|---|
| 文章 | `typing-records-v3` | モード×レベル（`${mode}__r${rank}`） |
| 単語 | `word-records-v2` | レベル×テーマ×モード |
| 英英辞典 | `dict-records-v1` | レベル×テーマ×モード |
| 物語（記録） | `story-records-v1` | 速度ランキング |
| 物語（発見エンド） | `story-endings-v1` | 到達したエンド |
| 問題ごとの記録 | `item-stats-v1` | `type:mode:key` 別の練習回数/打鍵/ミス/時間（収録一覧で表示） |

各ランキングは速い順（4択は正解数順）で最大 15 件（`MAX_RECORDS`）。タッチタイピングは記録を保存しません。
