import type { Meta, StoryObj } from '@storybook/react-vite';
import { WordTypeView, WordQuizView } from '@tll/ui';

const meta = {
  title: 'words/WordsView',
  component: WordTypeView,
} satisfies Meta<typeof WordTypeView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

// 単語の入力モード presenter（プレイ中）。上部フロー＋HUD を描く。TopSeg 列を手で組む。
const typeSegments = [
  { type: 'en', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'ja', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'ja', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
];
export const TypeTyping: Story = {
  render: () => (
    <WordTypeView
      levelLabel="単語 L1"
      metaSub="英語・日本語 / すべて"
      finished={false}
      resultNode={null}
      typedKeys={84}
      liveSpeed={210}
      mistakes={2}
      endStatLabel="残り"
      endStatValue="24秒"
      progress={0.6}
      segments={typeSegments}
      segIndex={2}
      segInput="dic"
      hasError={false}
    />
  ),
};

// 単語の4択クイズ presenter（プレイ中）。dir='ja'＝英語を見て日本語を選ぶ。
const quizOptions = [
  { display: '辞書', variants: ['じしょ'], kana: 'じしょ', answer: true, en: 'dictionary', ja: '辞書', jaKana: 'じしょ' },
  { display: '写真', variants: ['しゃしん'], kana: 'しゃしん', en: 'picture', ja: '写真', jaKana: 'しゃしん' },
  { display: '旅行', variants: ['りょこう'], kana: 'りょこう', en: 'travel', ja: '旅行', jaKana: 'りょこう' },
  { display: '朝', variants: ['あさ'], kana: 'あさ', en: 'morning', ja: '朝', jaKana: 'あさ' },
];
export const QuizPrompt: Story = {
  render: () => (
    <WordQuizView
      levelLabel="単語 L1"
      metaSub="日本語（4択） / すべて"
      finished={false}
      resultNode={null}
      dir="ja"
      typedKeys={12}
      correct={4}
      mistakes={1}
      endStatLabel="残り"
      endStatValue="18問"
      progress={0.4}
      prompt="dictionary"
      options={quizOptions}
      input=""
      picked={null}
      hasError={false}
      onPick={noop}
      onAdvance={noop}
    />
  ),
};
export const QuizTyping: Story = {
  render: () => (
    <WordQuizView
      levelLabel="単語 L1"
      metaSub="日本語（4択） / すべて"
      finished={false}
      resultNode={null}
      dir="ja"
      typedKeys={13}
      correct={4}
      mistakes={1}
      endStatLabel="残り"
      endStatValue="18問"
      progress={0.4}
      prompt="dictionary"
      options={quizOptions}
      input="じ"
      picked={null}
      hasError={false}
      onPick={noop}
      onAdvance={noop}
    />
  ),
};
