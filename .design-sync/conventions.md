# Typing Language Learning — UI コンポーネント

日本語話者向けの英語タイピング学習アプリ（英単語・英英辞典・単語例文・物語・タッチタイピング）の UI 部品。
**ダークテーマ専用**。`window.TLL.*`（例 `TLL.MarathonView`）で提供。プロバイダ不要（React context に非依存）。

## セットアップ（必須）

部品は**暗い背景に淡色テキスト**を前提に描画する。明るい面に置くと文字が読めない。必ずアプリ背景の中で使う。
トークンは `styles.css`（`src/App.css` を @import）が `:root` に定義する。

```jsx
<div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', padding: 20 }}>
  <TLL.StatsRow stats={[{ label: '経過', value: '32秒' }, { label: '速度', value: '4.2 打/秒' }]} progress={0.55} />
</div>
```

## スタイルの流儀：グローバル class 名 ＋ CSS 変数トークン

Tailwind でも props スタイルでもない。各部品は自前の className を持ち `styles.css` がそれを塗る。
**新しい class を作らず**、自作レイアウトは下のトークンと既存 class で組む。

**色トークン（`var(--*)`）**：`--bg`(地) `--panel`(面/カード) `--text`(文字) `--muted`(淡色/副次)
`--accent`(青・強調/選択) `--green`(正解・進捗) `--red`(ミス) `--gold`(記録)。

**主要 class ファミリ（実在・`styles.css` 由来）**：

| 用途 | class |
|---|---|
| コンテナ | `.app` `.result` `.mode-select` `.mode-group` |
| 選択ボタン | `.mode-btn` `.rank-btn` `.bottom-tab` `.type-tab` `.story-card` `.btn-primary` |
| 集計 | `.stat` `.stat-label` `.stat-value` `.stats` `.progress-bar` `.progress-fill` `.meta-badge` |
| 入力フロー | `.flow` `.flow-item` `.flow-row` `.flow-ja` `.flow-kana` `.chip` `.caret` |
| キーボード | `.kb` `.kb-row` `.kb-key` `.fg-li`〜`.fg-rr`(指=左右×小/薬/中/人) |
| 収録一覧 | `.browse-list` `.browse-item` `.bi-en` `.bi-ja` `.bi-def` `.bi-stat` |
| 打鍵着色 | `.rdone`(打了=緑) `.rerr`(ミス=赤) `.opt-typed` `.quiz-option-ja` |

**真実の所在**：`styles.css`（= `src/App.css` 全体）と各部品の `components/<group>/<Name>/<Name>.prompt.md`。塗る前に読む。

## 使い分け

- テキスト: `RubyText`(ふりがな) `MaskedRubyText`(伏字で高さ予約)。4択: `QuizOptionLabel` `OptionJa`。
- 準備画面: `Ready`(種類タブ→各セクション) と各セクション `WordsSection`/`DictSection`/`WordSentenceSection`/`StorySection`/`TouchSection`、`EndConditionSelect`、`ItemList`(収録一覧)。
- プレイ画面: `MarathonView`(単語/辞書/例文の連続入力) `Passage`(文章フロー) `TranslateView`(和文→英訳) `StoryView`(物語) `TouchView`(タッチ練習) `Keyboard`。
- 結果/集計: `Result` `RecordsTable` `SegStatsTable` `StatsRow` `Stat`・`SoundToggle`(効果音)。

各部品の props と例は `components/<group>/<Name>/<Name>.prompt.md` を参照。
