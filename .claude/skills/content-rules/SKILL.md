---
name: content-rules
description: 教材データ（単語・英英辞典・単語例文・グロス・物語）を追加/編集するときの規約と手順。単語を足すとき、英英の定義や例文を書くとき、読み（kana）をどう書くか迷ったとき、npm run validate / content:validate が赤いとき、add-words や merge-dict / merge-sentences を回すときに読む。正準ソース content/*.ndjson と生成物 src/content/*Data.js の区別、長音「ー」・づ/ぢ・特殊拗音の落とし穴、大量追加の並列パイプラインを扱う。詳細は docs/CONTENT.md。
---

# 教材データの規約

## 正準ソースは `content/*.ndjson`（生成物を手で編集しない）

| 種類 | 正準ソース（編集する） | 生成物（gitignore・触らない） |
|---|---|---|
| 単語 | `content/words.ndjson` | `src/content/wordsData.js` |
| 英英 | `content/dict.ndjson` | `src/content/dictionaryData.js` |
| 例文 | `content/sentences.ndjson` | `src/content/wordSentences/{L1..L4,theme,wsentCounts}.js` |
| グロス | `content/gloss.ndjson` | `src/content/wordGlossData.js` |
| 物語 | `content/stories/<id>.json` | `src/content/stories/<id>.js` |

生成は `npm run content:build`（`prebuild`/`predev`/`prevalidate`/`pretest` で自動）。**生成物 `.js` はコミットに含めない**。新たに生成物を増やしたら `.gitignore` と `eslint.config.js` の ignore にも登録する。アプリは遅延 import（`loadWords()`／`loadDict()`／`loadWsentLevel()`＋件数だけの `*_COUNTS`）で、**静的な全件 import は禁止**（`check-bundle` が 512KB 予算で落ちる）。Node ツールは全件版 `wordsAll.js` / `dictionaryAll.js` / `wordSentences/all.js`。

## レコードの形と不変条件（validate が強制）

```jsonc
// words.ndjson（freq は任意。あるなら level = bandOf(freq) 必須）
{"en":"water","ja":"水","kana":"みず","level":1,"theme":"日常"}
// dict.ndjson（def は英小文字と空白のみ。句読点・数字・大文字すべて NG）
{"word":"abroad","def":"in or to another country","ja":"外国で","kana":"がいこくで","level":1,"theme":"旅行","jaWords":["外国","で"]}
// sentences.ndjson（en でその語が実際に使われていること）
{"en":"The clouds are above the mountain.","word":"above","ja":"雲は山の上にあります。","kana":"くもはやまのうえにあります。","level":1,"jaWords":["雲","は","山","の","上","に","あり","ます"]}
// gloss.ndjson は {"en","ja"} だけ
```

- **`en` / `word` は英小文字のみ（`^[a-z]+$`）・重複不可**（単語・英英・例文それぞれの中で一意）。
- **`level` は 1〜4**。`freq` を書くなら `bandOf(freq)` と一致（L1=1–1000 / L2=1001–2000 / L3=2001–3000 / L4=3001–）。
- **`theme` は `日常` / `旅行` / `ビジネス` か省略**（英英は `null` 可）。
- **英英 ⊆ 単語**：`word` は必ず `words.ndjson` に在る語。`level` は単語と一致。`theme` は**単語が持つときだけ**一致（無ければ `null`）。新規英英は既存単語から見出し語を選ぶ。`ja`/`kana` は**単語の訳ではなく「定義文」の訳とその読み**。
- **例文 ⊆ 単語**：`word` が `words.ndjson` に在り、`en` でその語が使われ（語形変化は緩く許容）、`level` は単語と一致。
- **`jaWords` の連結 = `ja`**（末尾の `。、？！` を除く）。英英・例文の両方で検査される。
- **文末記号の対応**（例文）：英 `.`→和 `。`、`?`→`？`、`!`→`！`。**`kana` の末尾も同じ記号**にする。

## 読み（kana）の落とし穴 ← 事故はほぼここ

`kana` は**ひらがな**で書き、ローマ字化して完全に打鍵できることが条件（`toRomaji` → `^[a-z'.,?!-]+$` かつ全文字消費）。

### 1. カタカナ長音は読みも「ー」

母音重ね・脱落にしない。`-` キーで入力する。

| 語 | ○ 正 | × 誤 |
|---|---|---|
| ケーキ | `けーき`（`ke-ki`） | `けえき`(`keeki`) / `けき` |
| コーヒー | `こーひー`（`ko-hi-`） | `こおひい` / `こひ` |
| サッカー | `さっかー` | `さっかあ` |
| チョコレート | `ちょこれーと` | `ちょこれえと` |
| パーティー | `ぱーてぃー` | `ぱあていい` |

`jaWords` 側はカタカナのまま（`["私","の","兄","は","サッカー",…]`）。ひらがな化するのは `kana` だけ。

### 2. `づ` / `ぢ` は音ではなく表記どおり

`ず`/`じ` に潰さない。続く → `つづく`（×`つずく`）、鼓 → `つづみ`、縮む → `ちぢむ`、鼻血 → `はなぢ`、間近 → `まぢか`。逆に「稲妻＝いなずま」「地面＝じめん」のように**元から `ず`/`じ` の語を `づ`/`ぢ` にしない**。ローマ字は `du` / `di` になる（打鍵可）。

### 3. 特殊拗音 — 通るものと**通らないもの**がある

打鍵エンジンが受理する（安全）：

`てぃ`(teli) `でぃ`(deli) `ふぁふぃふぇふぉ` `ちぇ` `しぇ` `じぇ` `うぃうぇうぉ` `いぇ` `とぅ` `どぅ`

**validate が落ちる（未対応）**：

| NG かな | 例 | 対処 |
|---|---|---|
| `ゔ` | ヴァイオリン→`ゔぁいおりん` | `ば`行で書く → `ばいおりん` |
| `てゅ` `でゅ` `ふゅ` | デュエット→`でゅえっと` | その語を採用しない（別語に差し替え） |
| `くゎ` | — | `くわ` |
| `ヶ` `ゕ` `ゐ` `ゑ` | 一ヶ月 | 読みを開く → `いっかげつ` |
| `・` `〜` | — | 読みに記号を入れない |
| 漢字・数字が残る | 1つ→`1つ` | 全部かなに開く → `ひとつ` |

### 4. その他

- 促音 `っ`、撥音 `ん` はそのまま（`がっこう`＝`gakkou`、`しんぶん`＝`shinbunn`）。
- 助詞は**発音でなく表記**：`は`→`ha`、`へ`→`he`、`を`→`wo` のままでよい（`わ`/`え`/`お` に直さない）。
- カタカナ自体は変換可能だが、**規約としてひらがなに統一**する。
- 誤読は**化学・鉱物・生物などの専門語／難読和名**に集中する。点検はそこを重点的に。

## 大量追加の手順

**単語**：TSV（`en<TAB>ja<TAB>freq<TAB>theme(任意)<TAB>kana(任意)`、`#` はコメント。`.json` 配列も可）を用意する。

```bash
npm run add-words 候補.tsv            # 検査のみ（正準ソースは変更しない）
npm run add-words 候補.tsv -- --write # words.ndjson へ追記＋生成物再生成
```

`kana` 空欄なら `ja` から自動生成（kuroshiro）。**要レビュー**（固有名詞・難読語を誤る）。検査は en 重複／英小文字／freq 正整数／ローマ字完全消費／長音「ー」警告。NG があれば終了コード 1。

**英英**：`node scripts/gen-dict-wnja.mjs --count N --chunks M`（日本語WordNet から機械選定・生成AI不使用）→ `npm run merge-dict` → `-- --write`。**kana は手で書かない**（merge-dict が生成）。

**例文**：`npm run gen-sentences -- --count N --chunks M` → 各 `chunk-NN.json` をサブエージェントに読ませ `out-NN.json` 生成 → `npm run merge-sentences`（構造検証）→ `npm run check-readings`（`rev-*.json`）→ 点検で `revfix-N.json`（**真の誤りだけ**）→ `npm run merge-sentences -- --write`。

**数千語規模**：サブエージェント並列（1ラウンド6〜8体・各80〜90語、同時 ~16 まで、1ファイル1ライター）。候補は**ファイル直書き**（応答に語を載せない＝再出力コストを避ける）。飽和して重複が増えたら**形容詞・動詞・副詞＋専門分野**を混ぜる。点検は 200〜250語ごとに分割して並列で回す。

## validate が赤いとき

`npm run validate` は 2 本走る。エラー文の形で切り分ける。

| エラー文 | 出所 | 意味・直し方 |
|---|---|---|
| `content/xxx.ndjson 行N: …` | `content-validate.mjs`（NDJSON の構造・型・一意性） | その行を直す。行番号で一発 |
| `単語#N "…"` / `英英#N "…"` / `例文#N "…"` | `validate-sentences.mjs`（生成物への意味検証） | `en`/`word` で `content/*.ndjson` を grep して直す |
| `kana をローマ字化できません → "…"` | 読みに未対応文字（`ゔ` `ヶ` `てゅ` 漢字 数字 記号） | 上の「特殊拗音」表 |
| `kana 打鍵不能` / `読みを完全消費していません` | 消費漏れ（単語は**エラー**、英英・例文は**警告**で落ちない） | 読みを開き直す |
| `word が単語(words.js)に存在しません` | 英英/例文 ⊆ 単語 の違反 | 先に単語を追加するか、見出し語を既存単語に変える |
| `level が単語と不一致` | 英英/例文と単語の食い違い | **単語側の level を正**として合わせる |
| `jaWords の連結が ja と不一致` | 分かち書きの取りこぼし | 連結が `ja`（末尾記号除く）と一字一句一致するまで直す |
| `例文に単語 "…" が使われていません` | `en` に対象語が無い | `en` を書き直す（語形変化は許容される） |

**教材データは TDD 対象外**（正しさは `validate`／`check`／読み点検で担保）。ただしデータ構造を扱う domain/application の**ロジック**を変えるなら coder/test-author の領分。

詳細（SQLite 出力・物語のノード形式・wn-ja の由来と帰属・キーボード定義・モード/レベルの定義位置）は `docs/CONTENT.md`。
