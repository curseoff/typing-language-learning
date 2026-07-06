import type { Meta, StoryObj } from '@storybook/react-vite';
import { Passage } from '@tll/ui';

// 下部本文フロー。seg は type/canonical/variants（＋和文は ja/kana）。出題相当のセグメント列を手で組む。
const meta = {
  title: 'marathon/Passage',
  component: Passage,
} satisfies Meta<typeof Passage>;
export default meta;
type Story = StoryObj<typeof meta>;

const segments = [
  { type: 'en', canonical: 'good morning', variants: ['good morning'] },
  { type: 'ja', ja: 'おはよう', kana: 'おはよう', canonical: 'ohayou', variants: ['ohayou'] },
  { type: 'en', canonical: 'dictionary', variants: ['dictionary'] },
  { type: 'ja', ja: '辞書', kana: 'じしょ', canonical: 'jisho', variants: ['jisho', 'zisyo'] },
  { type: 'en', canonical: 'picture', variants: ['picture'] },
];

export const Typing: Story = {
  render: () => <Passage segments={segments} segIndex={2} segInput="dic" completed={{}} hasError={false} />,
};
export const Error: Story = {
  render: () => <Passage segments={segments} segIndex={2} segInput="dix" completed={{}} hasError={true} />,
};
