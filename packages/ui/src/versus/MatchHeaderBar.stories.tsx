import type { Meta, StoryObj } from '@storybook/react-vite';
import { MatchHeaderBar } from '@tll/ui';

// #439 対戦：画面最上部の独立ヘッダバー。種類/レベル/モード＋残り（時間 or 問題数）＋進捗バーを1本へ集約。
const meta = {
  title: 'versus/MatchHeaderBar',
  component: MatchHeaderBar,
} satisfies Meta<typeof MatchHeaderBar>;
export default meta;
type Story = StoryObj<typeof meta>;

// 英英・英語入力・時間制（残り時間）。
export const Dict: Story = {
  args: {
    levelLabel: 'L1',
    metaSub: '英英 / 英語入力 / すべて',
    statLabel: '残り',
    statValue: '42.0 / 60秒',
    progress: 0.3,
  },
};

// 単語・問題数制（残り問題）。
export const Words: Story = {
  args: {
    levelLabel: 'W1',
    metaSub: '英語・日本語 / すべて',
    statLabel: '残り',
    statValue: '8問',
    progress: 0.6,
  },
};

// 狭幅（320px）：メタと残り・進捗バーが収まることを確認。
export const Narrow320: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <MatchHeaderBar
        levelLabel="L1"
        metaSub="単語例文 / 英語・日本語 / すべて"
        statLabel="残り"
        statValue="12問"
        progress={0.45}
      />
    </div>
  ),
};
