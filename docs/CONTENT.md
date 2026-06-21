# 教材データの追加・編集（CONTENT）

出題データは `src/content/` にあります。編集したら **必ず `npm run validate`** で整合性を確認してください（読み→ローマ字変換、重複、レベル/テーマ、文末記号、長音ーの警告などを一括チェック）。

共通の注意：
- 読み（`kana`）は**ひらがな**で。長音「ー」と特殊拗音（チェ・ファ等）はローマ字入力しづらいため避ける
- 英語（`en` / `def`）はそのまま打鍵対象になります

## 文章（`content/sentences.js`）

```js
{
  rank: 1,
  en: 'I go to school every day.',
  ja: '私は毎日学校へ行きます。',
  kana: 'わたしはまいにちがっこうへいきます。',
  jaWords: ['私', 'は', '毎日', '学校', 'へ', '行き', 'ます'],
}
```

- `rank`: レベル 1〜6（`RANKS` に対応）
- `en`: 英文。末尾が `.`/`?` の文は `ja`/`kana` も `。`/`？` で終える
- `ja`: 漢字かな表示。`kana`: 読み（文末記号も含める）
- `jaWords`: 翻訳モードの単語チップ用。連結すると `ja`（句読点を除く）になるよう分割

## 単語（`content/words.js`）

```js
{ en: 'reserve', ja: '予約する', kana: 'よやくする', level: 2, theme: '旅行' }
```

- `en`: 英小文字の1語（重複不可）
- `ja`/`kana`: 和訳とその読み
- `level`: 1〜4（`WORD_LEVELS`：基礎/初級/中級/上級）
- `theme`: `日常` / `旅行` / `ビジネス`（`WORD_THEMES`）

## 英英辞典（`content/dictionary.js`）

```js
{
  word: 'hotel',
  def:  'a place where you stay when you travel', // 英小文字と空白のみ
  ja:   '旅行のとき泊まる場所',                      // 定義の和訳
  kana: 'りょこうのときとまるばしょ',                // 和訳の読み
  level: 1, theme: '旅行',
}
```

- `word`: 見出し語（英小文字・重複不可）
- `def`: やさしい英語の定義（句読点なし・英小文字と空白のみ）
- `ja`/`kana`: 定義の和訳とその読み
- `level` / `theme`: 単語と同じ区分

## 物語（`content/story.js`）

分岐グラフ `STORY = { title, start, endingCount, nodes }`。各ノード：

```js
{
  en: '...', ja: '...', kana: '...', jaWords: [...],   // 文章と同じ
  next: '次のノードID',                                  // 直線進行
  // または分岐：
  choices: [{ en, ja, kana, next }],
  // または終端：
  ending: 'エンドID', endLabel: '表示名',
}
```

## 検証

```bash
npm run validate
```

成功すると件数（文・単語・英英）と「✓ 検証OK」が表示されます。エラーがあると終了コード1で失敗します（CIでも実行されます）。

## モード／レベルの定義

- 入力モード … `content/modes.js`（`MODES`）
- 単語のレベル/テーマ/モード … `content/words.js`（`WORD_LEVELS` / `WORD_THEMES` / `WORD_MODES`）
- 英英のモード … `content/dictionary.js`（`DICT_MODES`）
- 文章のレベル … `content/sentences.js`（`RANKS`）

## 補足

- 単語・英英のレベルはデータがある分だけ表示されます（例: 英英はスターターのため L1〜L2 のみ）。レベルを増やすにはそのレベルの語/エントリを追加してください。
