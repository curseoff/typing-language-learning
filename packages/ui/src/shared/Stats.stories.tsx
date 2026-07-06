import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stat, StatsRow } from '@tll/ui';

const meta = {
  title: 'shared/Stats',
  component: Stat,
} satisfies Meta<typeof Stat>;
export default meta;
type Story = StoryObj<typeof meta>;

export const StatScore: Story = { render: () => <Stat label="スコア" value="1,240" /> };
export const StatSpeed: Story = { render: () => <Stat label="速度" value="4.2 打/秒" /> };
export const StatAccuracy: Story = { render: () => <Stat label="正確率" value="98%" /> };

const stats = [
  { label: '経過', value: '32秒' },
  { label: '入力', value: '128字' },
  { label: 'ミス', value: '3' },
  { label: '速度', value: '4.2 打/秒' },
];
export const StatsRowStart: Story = {
  render: () => <StatsRow stats={stats.map((s, i) => ({ label: s.label, value: i ? '0' : '0秒' }))} progress={0} />,
};
export const StatsRowMidway: Story = { render: () => <StatsRow stats={stats} progress={0.55} /> };
export const StatsRowComplete: Story = { render: () => <StatsRow stats={stats} progress={1} /> };
