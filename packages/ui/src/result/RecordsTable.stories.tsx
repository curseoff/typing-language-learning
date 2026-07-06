import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecordsTable } from '@tll/ui';

const meta = {
  title: 'result/RecordsTable',
  component: RecordsTable,
} satisfies Meta<typeof RecordsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const recs = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, endLabel: '60秒', date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, endLabel: '60秒', date: '2026-07-04 10:00' },
  { keys: 180, speed: 180, correctCount: 18, accuracy: 92, seconds: 60, endLabel: '60秒', date: '2026-07-03 09:30' },
];

export const Ranking: Story = {
  render: () => <RecordsTable records={recs} modeKey="both" rankText="英語・日本語" endCondition={{ kind: 'time', value: 60 }} />,
};
export const Empty: Story = {
  render: () => <RecordsTable records={[]} modeKey="both" rankText="英語・日本語" endCondition={{ kind: 'time', value: 60 }} />,
};
