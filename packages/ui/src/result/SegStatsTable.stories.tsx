import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegStatsTable } from '@tll/ui';

const meta = {
  title: 'result/SegStatsTable',
  component: SegStatsTable,
} satisfies Meta<typeof SegStatsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const quiz = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
  { no: 3, label: 'travel', answer: '旅行', correct: true, mistakes: 1 },
];

export const Quiz: Story = { render: () => <SegStatsTable segStats={quiz} /> };
