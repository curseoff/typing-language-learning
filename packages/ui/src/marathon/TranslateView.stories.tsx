import type { Meta, StoryObj } from '@storybook/react-vite';
import { TranslateView } from '@tll/ui';

// 英訳モード（和文→英語）。TrSeg は type/ja/en/kana/chips に加え、着色計算で canonical/variants/words を使う。
const meta = {
  title: 'marathon/TranslateView',
  component: TranslateView,
} satisfies Meta<typeof TranslateView>;
export default meta;
type Story = StoryObj<typeof meta>;

const segments = [
  {
    type: 'en',
    en: 'good morning',
    ja: 'おはよう',
    kana: 'おはよう',
    canonical: 'good morning',
    variants: ['good morning'],
    words: ['good', 'morning'],
    chips: [
      { text: 'morning', i: 1 },
      { text: 'good', i: 0 },
    ],
  },
  {
    type: 'en',
    en: 'thank you',
    ja: 'ありがとう',
    kana: 'ありがとう',
    canonical: 'thank you',
    variants: ['thank you'],
    words: ['thank', 'you'],
    chips: [
      { text: 'you', i: 1 },
      { text: 'thank', i: 0 },
    ],
  },
];

export const ToEnglish: Story = {
  render: () => <TranslateView segments={segments} segIndex={0} segInput="" hasError={false} />,
};
export const Typing: Story = {
  render: () => <TranslateView segments={segments} segIndex={0} segInput="good " hasError={false} />,
};
