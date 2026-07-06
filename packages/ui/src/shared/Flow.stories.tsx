import type { Meta, StoryObj } from '@storybook/react-vite';
import { Flow } from '@tll/ui';

const meta = {
  title: 'shared/Flow',
  component: Flow,
} satisfies Meta<typeof Flow>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { en: 'Good morning', ja: 'おはよう', kana: 'おはよう' },
  { en: 'How are you?', ja: '元気ですか', kana: 'げんきですか' },
];

export const Wrap: Story = {
  render: () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa />,
};
export const Ticker: Story = {
  render: () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" ticker showEn showJa />,
};
export const EnglishOnly: Story = {
  render: () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa={false} />,
};
export const JapaneseTyping: Story = {
  render: () => (
    <Flow items={items} cur={0} enDone={12} jaDone={2} jaKanaDone={2} activeRow="ja" wrap showEn showJa />
  ),
};
