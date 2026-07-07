import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegStatsTable } from '@tll/ui';

const meta = {
  title: 'result/SegStatsTable',
  component: SegStatsTable,
} satisfies Meta<typeof SegStatsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const quiz = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0, picked: '辞書', pickedEn: 'dictionary', pickedJa: '辞書' },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2, picked: '絵', pickedEn: 'drawing', pickedJa: '絵' },
  { no: 3, label: 'travel', answer: '旅行', correct: true, mistakes: 1, picked: '旅行', pickedEn: 'travel', pickedJa: '旅行' },
];

// 旧記録（picked/en/ja 無し）でも壊れない後方互換の確認用。
const quizLegacy = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
];

const input = [
  { no: 1, type: 'en' as const, en: 'apple', ja: 'りんご', kana: 'りんご', label: 'apple', speed: 240, mistakes: 0, partial: false },
  { no: 2, type: 'ja' as const, en: 'apple', ja: 'りんご', kana: 'りんご', label: 'りんご', speed: 180, mistakes: 1, partial: false },
  { no: 3, type: 'en' as const, label: 'banana', speed: 200, mistakes: 0, partial: true },
];

export const Quiz: Story = { render: () => <SegStatsTable segStats={quiz} /> };
export const QuizLegacy: Story = { render: () => <SegStatsTable segStats={quizLegacy} /> };
export const Input: Story = { render: () => <SegStatsTable segStats={input} /> };
