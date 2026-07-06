import { WordQuizView } from '@tll/ui';
// 単語の4択クイズ presenter（プレイ中）。dir='ja'＝英語を見て日本語を選ぶ。
const noop = () => {};
const options = [
  { display: '辞書', variants: ['じしょ'], kana: 'じしょ', answer: true, en: 'dictionary', ja: '辞書', jaKana: 'じしょ' },
  { display: '写真', variants: ['しゃしん'], kana: 'しゃしん', en: 'picture', ja: '写真', jaKana: 'しゃしん' },
  { display: '旅行', variants: ['りょこう'], kana: 'りょこう', en: 'travel', ja: '旅行', jaKana: 'りょこう' },
  { display: '朝', variants: ['あさ'], kana: 'あさ', en: 'morning', ja: '朝', jaKana: 'あさ' },
];
export const Prompt = () => (
  <WordQuizView levelLabel="単語 L1" metaSub="日本語（4択） / すべて" finished={false} resultNode={null}
    dir="ja" typedKeys={12} correct={4} mistakes={1} endStatLabel="残り" endStatValue="18問" progress={0.4}
    prompt="dictionary" options={options} input="" picked={null} hasError={false} onPick={noop} onAdvance={noop} />
);
export const Typing = () => (
  <WordQuizView levelLabel="単語 L1" metaSub="日本語（4択） / すべて" finished={false} resultNode={null}
    dir="ja" typedKeys={13} correct={4} mistakes={1} endStatLabel="残り" endStatValue="18問" progress={0.4}
    prompt="dictionary" options={options} input="じ" picked={null} hasError={false} onPick={noop} onAdvance={noop} />
);
