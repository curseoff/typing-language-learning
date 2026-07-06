import type { Meta, StoryObj } from '@storybook/react-vite';
import { DictTypeView, DictQuizView, DictPickView } from '@tll/ui';

const meta = {
  title: 'dictionary/DictView',
  component: DictTypeView,
} satisfies Meta<typeof DictTypeView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

// 英英辞典の入力モード presenter（プレイ中）。定義文をティッカーで打つ。
const typeSegments = [
  { type: 'en', en: 'a book that lists words and their meanings', ja: '', kana: '', sentenceIndex: 0 },
];
export const TypeTyping: Story = {
  render: () => (
    <DictTypeView
      levelLabel="英英 L1"
      metaSub="英語入力 / すべて"
      finished={false}
      resultNode={null}
      typedKeys={96}
      liveSpeed={230}
      mistakes={3}
      endStatLabel="残り"
      endStatValue="30秒"
      progress={0.55}
      word="dictionary"
      wordJa="辞書"
      hintLead="この語を英語で説明した文を打ちます。"
      segments={typeSegments}
      segIndex={0}
      segInput="a book that l"
      hasError={false}
    />
  ),
};

// 英英辞典の単語4択 presenter（プレイ中）。定義文を見て見出し語を選ぶ。
const quizOptions = [
  { display: 'dictionary', variants: ['dictionary'], answer: true, ja: '辞書' },
  { display: 'picture', variants: ['picture'], ja: '写真' },
  { display: 'travel', variants: ['travel'], ja: '旅行' },
  { display: 'morning', variants: ['morning'], ja: '朝' },
];
const wordRuby = { dictionary: { ja: '辞書', kana: 'じしょ' }, picture: { ja: '写真', kana: 'しゃしん' } };
export const QuizPrompt: Story = {
  render: () => (
    <DictQuizView
      levelLabel="英英 L1"
      metaSub="単語（4択） / すべて"
      finished={false}
      resultNode={null}
      typedKeys={20}
      correct={5}
      mistakes={1}
      endStatLabel="残り"
      endStatValue="15問"
      progress={0.5}
      prompt="a book that lists words and their meanings"
      promptJa="単語とその意味を並べた本"
      options={quizOptions}
      wordRuby={wordRuby}
      input=""
      picked={null}
      hasError={false}
      onPick={noop}
      onAdvance={noop}
    />
  ),
};

// 英英辞典の説明文4択 presenter（プレイ中）。見出し語を見て正しい説明文を選ぶ。
const pickOptions = [
  { display: 'a book that lists words and their meanings', variants: ['a'], answer: true },
  { display: 'a painting, drawing, or photograph', variants: ['a'] },
  { display: 'the act of going from one place to another', variants: ['the'] },
];
export const PickPrompt: Story = {
  render: () => (
    <DictPickView
      levelLabel="英英 L1"
      metaSub="説明（4択） / すべて"
      finished={false}
      resultNode={null}
      typedKeys={18}
      correct={4}
      mistakes={2}
      endStatLabel="残り"
      endStatValue="12問"
      progress={0.45}
      prompt="dictionary"
      headJa="辞書"
      options={pickOptions}
      input=""
      picked={null}
      hasError={false}
      onPick={noop}
      onAdvance={noop}
    />
  ),
};
