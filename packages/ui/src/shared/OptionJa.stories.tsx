import type { Meta, StoryObj } from '@storybook/react-vite';
import { OptionJa } from '@tll/ui';

const meta = {
  title: 'shared/OptionJa',
  component: OptionJa,
} satisfies Meta<typeof OptionJa>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Revealed: Story = { render: () => <OptionJa ja="辞書" kana="じしょ" revealed={true} /> };
export const Masked: Story = { render: () => <OptionJa ja="辞書" kana="じしょ" revealed={false} /> };
export const EnglishSide: Story = { render: () => <OptionJa ja="dictionary" revealed={true} /> };
