import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuizOptionLabel } from '@tll/ui';

const meta = {
  title: 'shared/QuizOptionLabel',
  component: QuizOptionLabel,
} satisfies Meta<typeof QuizOptionLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

const jaOpt = { display: '辞書', variants: ['じしょ'], kana: 'じしょ' };
const enOpt = { display: 'dictionary', variants: ['dictionary'] };

export const JapaneseOption: Story = {
  render: () => <QuizOptionLabel opt={jaOpt} input="" picked={null} hasError={false} />,
};
export const JapaneseTyping: Story = {
  render: () => <QuizOptionLabel opt={jaOpt} input="じ" picked={null} hasError={false} />,
};
export const EnglishOption: Story = {
  render: () => <QuizOptionLabel opt={enOpt} input="" picked={null} hasError={false} />,
};
export const EnglishTyping: Story = {
  render: () => <QuizOptionLabel opt={enOpt} input="dict" picked={null} hasError={false} />,
};
