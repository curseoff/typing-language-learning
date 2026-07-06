import type { Preview } from '@storybook/react-vite';
// @tll/ui は「ダークテーマ専用」で var(--*) を前提に描く。dist の CSS を読み込みつつ、
// アプリの :root トークン（src/App.css と同一値）を decorator のラッパに定義して継承させる。
// design-sync の DSFrame と同じ考え方。
import '../packages/ui/dist/styles.css';

// 値は src/App.css の :root と同一。CSS custom property は子孫へ継承する。
const TOKENS: React.CSSProperties = {
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
} as React.CSSProperties;

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          ...TOKENS,
          background: 'var(--bg)',
          color: 'var(--text)',
          padding: 20,
          minHeight: '100vh',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
