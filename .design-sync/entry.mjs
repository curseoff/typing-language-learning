// design-sync 用エントリ。@tll/ui（正本パッケージ）を丸ごと再export し、プレビュー用の
// ダーク背景 provider DSFrame だけ足す。旧来の「electron 回避＋全 src 列挙＋データスタブ」の
// ハックは不要になった（@tll/ui は正規パッケージ・重データ import 無し・実型付き）。
import React from 'react';
export * from '@tll/ui';
export function DSFrame({ children }) {
  return React.createElement(
    'div',
    { style: { background: 'var(--bg)', color: 'var(--text)', padding: '20px', minHeight: '100%' } },
    children,
  );
}
