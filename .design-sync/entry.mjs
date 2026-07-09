// design-sync 用エントリ。@tll/ui（正本パッケージ）を丸ごと再export し、プレビュー用の
// ダーク背景 provider DSFrame だけ足す。旧来の「全 src 列挙＋データスタブ」の
// ハックは不要になった（@tll/ui は正規パッケージ・重データ import 無し・実型付き）。
import React from 'react';
export * from '@tll/ui';

// アプリの :root トークン（src/App.css）は @tll/ui の dist には含まれない（コンポーネント CSS だけを
// 出荷する設計）。@tll/ui は「ダークテーマ専用」で var(--*) を前提に描くので、プレビューでは
// provider のラッパ要素に同じパレットを定義して継承させる（CSS custom property は子孫へ継承する）。
// 値はアプリの正本（src/App.css の :root）と同一。ここはアプリ非結合の design-sync 入力。
const TOKENS = {
  '--bg': '#0f172a',
  '--panel': '#1e293b',
  '--panel-2': '#273449',
  '--text': '#e2e8f0',
  '--muted': '#94a3b8',
  '--muted-fn': '#aeb9c9',
  '--accent': '#38bdf8',
  '--green': '#4ade80',
  '--red': '#f87171',
  '--gold': '#fbbf24',
};
export function DSFrame({ children }) {
  return React.createElement(
    'div',
    { style: { ...TOKENS, background: 'var(--bg)', color: 'var(--text)', padding: '20px', minHeight: '100%' } },
    children,
  );
}
