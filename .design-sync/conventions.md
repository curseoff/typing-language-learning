# Typing Language Learning — UI コンポーネント

日本語話者向けの英語タイピング学習アプリ（英単語・英英辞典・単語例文・物語・タッチタイピング）の UI 部品。
**ダークテーマ専用**。`window.TLLUI.*`（例 `TLLUI.StatsRow`）で提供。React context には非依存（プレビューは `DSFrame` provider がダーク地＝トークンを供給する）。

## セットアップ（必須）

部品は**暗い背景に淡色テキスト**を前提に描画する。明るい面に置くと文字が読めない。必ずアプリ背景の中で使う。
トークンは `styles.css`（`src/App.css` を @import）が `:root` に定義する。

```jsx
<div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', padding: 20 }}>
  <TLLUI.StatsRow stats={[{ label: '経過', value: '32秒' }, { label: '速度', value: '4.2 打/秒' }]} progress={0.55} />
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

- テキスト: `RubyText`(ふりがな) `MaskedRubyText`(伏字で高さ予約) `Chars`/`Typed`/`MaskedText`(打鍵着色) `Chips`(単語チップ)。4択: `QuizOptionLabel` `OptionJa`。
- 準備画面（presenter）: `RankSectionView`(単語/英英/単語例文の共通セクション＝レベル×テーマ×モード) と `StorySectionView`(物語)。どちらも `EndConditionSelect`(終了条件)や `ItemList`/`RecordsTable`(収録一覧/記録) を `endConditionNode`/`browseNode` として container から受ける。共有部品は `ModeButtons` `SectionLabel` `BottomTabs` `StartRow`。
- プレイ画面（presenter）: 単語 `WordTypeView`(入力)/`WordQuizView`(4択)、英英 `DictTypeView`(定義入力)/`DictQuizView`(単語4択)/`DictPickView`(説明4択)。共通の上部フローは `TopFlow`(ティッカー) `Flow`。連続文入力は `Passage`、和文→英訳は `TranslateView`、物語は `StoryView`、タッチ練習は `TouchView`＋`Keyboard`。
- 結果/集計: `Result`(単語例文) `PlayResultView`(単語/英英) `RecordsTable` `SegStatsTable` `StatsRow` `Stat`・`SoundToggle`(効果音)。

各部品の props と例は `components/<group>/<Name>/<Name>.prompt.md` を参照。View presenter（`WordTypeView` 等）はフックの state を container が props で渡す純粋描画。
