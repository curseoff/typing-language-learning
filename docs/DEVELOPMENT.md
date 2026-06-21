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
| `npm run test` | Vitest（ドメインの回帰テスト） |
| `npm run validate` | 教材データの整合性チェック（文・単語・英英） |
| **`npm run check`** | **lint → test → validate → build を一括実行** |

「完了」とする前に **`npm run check`** を通すことを推奨します。

## 品質チェック

- **ESLint**（`eslint.config.js`, Flat config）
  - `eslint-plugin-react` / `react-hooks` を使用。未定義参照（白画面の原因）や `useEffect` 依存ミスを検出
- **Vitest**（`src/**/*.test.js`）
  - ドメイン層（`romaji` / `typing` / `marathon` / `words` / `dictionary` / `records`）の回帰テスト
  - 過去の不具合（漢字↔読みアライメント、600文字で詰む 等）をテストで固定
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

各ランキングは速い順（4択は正解数順）で最大 15 件（`MAX_RECORDS`）。
