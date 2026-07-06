import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Chars,
  RubyChars,
  RubyTyped,
  RubyText,
  MaskedRubyText,
  Typed,
  MaskedText,
  Chips,
} from '@tll/ui';

const meta = {
  title: 'shared/Text',
  component: Chars,
} satisfies Meta<typeof Chars>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CharsTyping: Story = { render: () => <Chars text="dictionary" done={4} cursor={4} hasError={false} /> };
export const CharsError: Story = { render: () => <Chars text="dictionary" done={4} cursor={4} hasError={true} /> };
export const CharsDone: Story = { render: () => <Chars text="travel" done={6} cursor={-1} hasError={false} /> };

export const RubyCharsTyping: Story = {
  render: () => <RubyChars ja="辞書" kana="じしょ" done={0} cursor={0} kanaDone={2} hasError={false} />,
};
export const RubyCharsDone: Story = {
  render: () => <RubyChars ja="旅行" kana="りょこう" done={2} cursor={-1} kanaDone={4} hasError={false} />,
};
export const RubyCharsError: Story = {
  render: () => <RubyChars ja="写真" kana="しゃしん" done={0} cursor={0} kanaDone={1} hasError={true} />,
};

export const RubyTypedTyping: Story = {
  render: () => <RubyTyped ja="辞書" kana="じしょ" done={0} kanaDone={2} hasError={false} />,
};
export const RubyTypedError: Story = {
  render: () => <RubyTyped ja="辞書" kana="じしょ" done={0} kanaDone={1} hasError={true} />,
};

export const RubyTextWord: Story = { render: () => <RubyText ja="辞書" kana="じしょ" /> };
export const RubyTextSentence: Story = { render: () => <RubyText ja="今日は良い天気です" kana="きょうはよいてんきです" /> };
export const RubyTextMixed: Story = { render: () => <RubyText ja="図書館で本を借りる" kana="としょかんでほんをかりる" /> };

export const MaskedRubyTextWord: Story = { render: () => <MaskedRubyText ja="辞書" kana="じしょ" /> };
export const MaskedRubyTextSentence: Story = {
  render: () => <MaskedRubyText ja="今日は良い天気です" kana="きょうはよいてんきです" />,
};

export const TypedProgress: Story = { render: () => <Typed text="dictionary" done={4} hasError={false} /> };
export const TypedError: Story = { render: () => <Typed text="dictionary" done={4} hasError={true} /> };

export const MaskedTextMasked: Story = { render: () => <MaskedText text="dictionary" pos={4} hasError={false} /> };
export const MaskedTextError: Story = { render: () => <MaskedText text="dictionary" pos={4} hasError={true} /> };

const chips = [
  { text: 'I', i: 0 },
  { text: 'like', i: 1 },
  { text: 'this', i: 2 },
  { text: 'book', i: 3 },
];
export const ChipsTyping: Story = {
  render: () => <Chips chips={chips} used={2} curDone={2} curKanaDone={0} hasError={false} />,
};
