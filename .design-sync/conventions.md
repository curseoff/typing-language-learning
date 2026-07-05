# Typing Language Learning — UI コンポーネント

タイピング学習アプリ（日本語話者向け英単語・英英辞典・タッチタイピング）の UI 部品。
**ダークテーマ専用**。`window.TLL.*`（例 `TLL.TouchSection`）で提供。

## セットアップ（必須）

これらの部品は**暗い背景に淡色テキスト**を前提に描画される。明るい面に置くと文字が読めない。
必ずアプリの背景の中で使うこと。トークンは `styles.css`（`src/App.css` を @import）が `:root` に定義する。

```jsx
// ルート（またはカードの器）を必ずダーク地にする
<div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', padding: 20 }}>
  <TLL.StatsRow
    stats={[{ label: '経過', value: '32秒' }, { label: '速度', value: '4.2 打/秒' }]}
    progress={0.55}
  />
</div>
```

プロバイダは不要（React context には依存しない）。唯一の前提が上記の**ダーク背景**。

## スタイルの流儀

- **グローバル class 名 + CSS 変数トークン**。Tailwind でも props スタイルでもない。各部品は自前の
  className（`.stat` `.mode-btn` `.flow-item` `.browse-item` `.progress-fill` など）を持ち、
  `styles.css` がそれらを塗る。**新しい class を作らず**、自作レイアウトは下のトークンで組む。
- 色トークン（`var(--*)`）: `--bg`（地）`--panel`（面）`--text`（文字）`--muted`（淡色）
  `--accent`（青・強調）`--green`（正解/進捗）`--red`（ミス）`--gold`（記録）。
- 真実は `styles.css`（= `src/App.css`）と各部品の `<Name>.prompt.md` にある。塗る前にそこを読む。

## 使い分け（抜粋）

- 表示テキスト: `RubyText`（ふりがな付き漢字）`MaskedRubyText`（伏字で高さ予約）。
- 4択: `QuizOptionLabel`（打鍵で色づく選択肢）`OptionJa`（選択肢下の反対側スロット）。
- 準備画面のセクション: `TouchSection` `EndConditionSelect`、収録一覧 `ItemList`。
- 進行/集計: `Flow`（英日の入力フロー）`StatsRow` `Stat`。

各部品の props と例は `components/<group>/<Name>/<Name>.prompt.md` を参照。
