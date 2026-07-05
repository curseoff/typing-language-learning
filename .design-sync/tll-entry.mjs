// design-sync 用 手書きエントリ（TOP範囲・データ非依存の軽量コンポーネントのみ）
// 教材データ(words/dict/sentences/stories)を引き込む section 系は 5MB 制限のため一旦除外。
import React from 'react';

export { default as TouchSection } from '../src/ui/ready/TouchSection.jsx';
export { default as EndConditionSelect } from '../src/ui/ready/EndConditionSelect.jsx';
export { default as ItemList } from '../src/ui/ready/ItemList.jsx';
export { default as QuizOptionLabel } from '../src/ui/shared/QuizOptionLabel.jsx';
export { default as OptionJa } from '../src/ui/shared/OptionJa.jsx';
export { Flow } from '../src/ui/shared/Flow.jsx';
export { Stat, StatsRow } from '../src/ui/shared/Stats.jsx';
export { RubyText, MaskedRubyText } from '../src/ui/shared/Text.jsx';

// プレビュー用の共通ダーク背景ラッパ（アプリの body 背景＝var(--bg)/文字色＝var(--text) を再現）。
// ダークテーマ前提の淡色テキストが白カード上で不可視になるのを防ぐ。provider として全プレビューに適用。
export function DSFrame({ children }) {
  return React.createElement(
    'div',
    { style: { background: 'var(--bg)', color: 'var(--text)', padding: '20px', minHeight: '100%' } },
    children,
  );
}
