# 英文・和文タイピング

日本人のための英語学習タイピングゲームです。レベル（日常会話→ビジネス会話）とモードを選び、表示された文章を打ち切るとタイム・速度が記録されます。和文はローマ字で入力でき、漢字はそのまま表示されます。さらに、選択肢で分岐する**物語モード**も収録。

React + Vite 製。ブラウザでも Electron のデスクトップアプリとしても動きます。

## 特徴

- **5つのモード**：英語と日本語の出し方／訳し方を選べる
  - `英語・日本語`（交互）／`英語`（英文のみ）／`日本語`（和文のみ）
  - `英語訳`（和文を見て英語に翻訳）／`日本語訳`（英文を見て日本語に翻訳）
- **6つのレベル（ランク）＋物語**：場面と丁寧さが上がるほど難度も上がる
  - 日常会話：R1 あいさつ・自己紹介／R2 日常生活／R3 旅行・外出
  - ビジネス会話：R4 オフィスの基本／R5 電話・連絡／R6 会議・交渉
  - 物語：📖 海外旅行アドベンチャー（分岐ストーリー）
- **自由なローマ字入力**：`shi`/`si`、`tsu`/`tu`、`ji`/`zi`、促音 `gakkou`、撥音 `n`/`nn` などどれでもOK。入力した綴りに表示が追従
- **日本語は漢字で表示**：ローマ字で打つと、対応する漢字が順に色づく（読みは隠れる）
- **間違えると正しく打つまで進めない**（打ち間違いは消さなくてよい）
- **文末記号も入力**：英 `.` → 和 `。`／英 `?` → 和 `？`。文と文の区切りに空白入力は不要
- **600文字で終了**し、速度（打/分）・時間・ミス・正確率を表示
- **問題ごとの記録**（1文ごとの速度とミス回数）を一覧表示
- **記録ランキング**を速い順に最大15件保存（**モード×レベルごと**に独立、アプリ/ブラウザ内に永続化）

### 翻訳モード（英語訳・日本語訳）

単語チップ（ワードバンク）を組み立てる翻訳練習です。

- 上部に原文（英語訳なら日本語、日本語訳なら英語）を表示
- 中央に訳の**単語チップ**をシャッフル表示（打ち終えると消える）
- 入力欄は**伏せ字で始まり、正しく打つと文字が現れる**

### 物語モード（海外旅行アドベンチャー）

テキストを打って物語を進め、**選択肢を打つと分岐**するサウンドノベル風モードです。

- レベル選択の最後（ビジネス会話の次）に「📖 海外旅行アドベンチャー」があり、選んで開始
- **4つのエンド**があり、発見したエンドを記録（エンド回収）
- 上で選んだ**モード（英語/日本語/翻訳など）がそのまま適用**される

## 動かす

前提: Node.js 18 以上。

```bash
npm install      # 初回のみ
npm run dev      # 開発サーバー起動 → http://localhost:5173
```

ブラウザ（Chrome推奨）で開けば遊べます。

## Electron（任意・各自ビルド）

デスクトップアプリ版が欲しい場合は、**各自でビルド**してください（配布物は提供していません。公式の配布はWeb版のみです）。

```bash
npm run electron:dev   # ウィンドウで起動（ホットリロード付き、開発用）
npm run dist:dir       # 動作確認用パッケージを release/ に生成（インストーラ無し）
npm run dist           # インストーラを release/ に生成
```

- `npm run dist` を実行したOSの形式で出力されます（macOS=`.dmg` / Windows=`.exe` / Linux=`.AppImage`）。
- アプリは**未署名**です。macOSでは初回起動時に警告が出るため、`.app` を右クリック →「開く」で回避してください。
- アイコンは未設定（Electron既定）。`build/icon.icns`(Mac) / `build/icon.ico`(Win) / `build/icon.png`(Linux) を置くと自動採用されます。
- 記録の保存先（ビルド版）：`~/Library/Application Support/EigoTyping/Local Storage/`（localStorage / 非公開）。

## 遊び方

1. スタート画面で**レベル（または物語）**と**モード**を選ぶ
2. 「スタート」または `Enter` で開始（最初の正しい打鍵で計測開始）
   - 英文はそのまま入力（大文字・記号も）
   - 和文はローマ字で入力（漢字表示のまま、打つと色づく）。例: `彼は公園で走ります。` → `karehakouendehashirimasu.`
   - 翻訳モードは、原文とチップを見て訳を入力（最初は伏せ字、正しく打つと現れる）
   - 物語モードは、文を打って進め、分岐点では選択肢の文を打って選ぶ
3. 打ち間違えると赤く表示され、正しいキーを打つまで進めません
4. （マラソン）600文字に到達すると結果画面へ。速度・問題ごとの記録・ランキングが表示されます

### キーボード操作

| キー | 動作 | 画面 |
|---|---|---|
| `↑` `↓` | レベル／物語の切り替え | トップ |
| `←` `→` | モード切り替え | トップ |
| `Enter` | スタート / もう一度（物語は最初から） | トップ・結果・物語エンド |
| `Esc` | トップへ戻る（中断） | プレイ中・結果・物語 |

## カスタマイズ

出題文は `src/content/sentences.js` を編集して追加・差し替えできます。

```js
{
  rank: 1,
  en: 'I go to school every day.',
  ja: '私は毎日学校へ行きます。',
  kana: 'わたしはまいにちがっこうへいきます。',
  jaWords: ['私', 'は', '毎日', '学校', 'へ', '行き', 'ます'],
}
```

- `rank`: レベル（1〜6）。`RANKS` の定義に対応
- `en`: 英文（そのまま入力対象）。末尾が `?` の文は `ja`/`kana` も `？` で終える
- `ja`: 和文の表示（漢字かな）。文末は `。` または `？`
- `kana`: 和文の読み（ひらがな）。ローマ字入力の判定に使う。文末記号も含める
  - 長音「ー」と特殊拗音（チェ・ファ等）はローマ字入力しづらいため避ける
- `jaWords`: 翻訳モードの単語チップ用。連結すると `ja`（句読点を除く）になるよう分割

編集したら**必ず検証**を実行（読み変換・jaWords連結・文末記号などを一括チェック）:

```bash
npm run validate
```

その他の調整箇所:

- 物語データ … `src/content/story.js`（ノード・選択肢・エンド）
- モード／レベルの定義 … `src/content/modes.js`（`MODES`）／ `src/content/sentences.js`（`RANKS`）
- 終了文字数 … `TARGET_KEYS`（`src/domain/marathon/passage.js`、既定 600）
- ランキング件数 … `MAX_RECORDS`（`src/domain/records/ranking.js`、既定 15）

## 構成（ドメイン駆動設計のレイヤード構成）

React から純粋なドメインロジックを隔離した構成です。依存方向は内向き（`ui → application → domain`、`application → infrastructure`）。規約は **`.js`=ドメイン/データ、`.jsx`=UI**。

```
.
├─ index.html / vite.config.js / package.json / LICENSE(MIT)
├─ electron/main.cjs              Electronメインプロセス
├─ scripts/validate-sentences.mjs 問題文データの整合性チェック（npm run validate）
└─ src/
   ├─ main.jsx / App.jsx          エントリ／合成（状態・ナビ・画面ルーティング）
   ├─ App.css
   ├─ domain/                     純粋ロジック（Reactなし）
   │  ├─ romaji/romaji.js         かな⇄ローマ字エンジン
   │  ├─ typing/{units,progress}.js  セグメント生成／入力進捗
   │  ├─ marathon/{passage,scoring}.js  出題生成／採点
   │  ├─ story/navigation.js      物語グラフのナビゲーション
   │  └─ records/ranking.js       記録ランキングのルール
   ├─ content/                    教材データ＋ラベル
   │  ├─ sentences.js（SENTENCES/RANKS）/ modes.js（MODES）/ story.js（STORY）
   ├─ infrastructure/             永続化（localStorage）
   │  └─ recordsRepository.js / storyRepository.js
   ├─ application/                ユースケース（フック）
   │  └─ useMarathon.js / useStory.js
   └─ ui/                         プレゼンテーション
      ├─ shared/{Text,Stats,Flow}.jsx + index.js
      ├─ ready/Ready.jsx
      ├─ marathon/{MarathonView,TopFlow,TranslateView,Passage}.jsx
      ├─ result/{Result,RecordsTable,SegStatsTable}.jsx
      └─ story/StoryView.jsx
```

## 技術メモ

- ローマ字判定は `domain/romaji/romaji.js` がかな読みから「許容する全ローマ字パターン」を展開して照合（`shi`/`si` などを同時に許容）。表示は標準（ヘボン式）を既定にしつつ、入力に追従して切り替わる。
- 日本語の漢字表示は、漢字↔かなの簡易アライメント（`domain/typing/progress.js`）でローマ字入力の進捗を漢字位置に変換して色づける。
- 記録は `localStorage`（キー: `typing-records-v3`）に **モード×レベル別**（`${mode}__r${rank}`）で保存。速い順で各最大15件。物語の発見エンドは別キーで保存。
- 速度 = 文字数 ÷ 経過分（打/分）。問題ごとの速度・ミスは1文単位で計測。

## ライセンス

[MIT License](LICENSE) © 2026 Atsushi Yamaguchi
