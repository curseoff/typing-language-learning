import { DictQuizView } from '@tll/ui';
// 英英辞典の単語4択 presenter（プレイ中）。定義文を見て見出し語を選ぶ。
const noop = () => {};
const options = [
  { display: 'dictionary', variants: ['dictionary'], answer: true, ja: '辞書' },
  { display: 'picture', variants: ['picture'], ja: '写真' },
  { display: 'travel', variants: ['travel'], ja: '旅行' },
  { display: 'morning', variants: ['morning'], ja: '朝' },
];
const wordRuby = { dictionary: { ja: '辞書', kana: 'じしょ' }, picture: { ja: '写真', kana: 'しゃしん' } };
export const Prompt = () => (
  <DictQuizView levelLabel="英英 L1" metaSub="単語（4択） / すべて" finished={false} resultNode={null}
    typedKeys={20} correct={5} mistakes={1} endStatLabel="残り" endStatValue="15問" progress={0.5}
    prompt="a book that lists words and their meanings" promptJa="単語とその意味を並べた本"
    options={options} wordRuby={wordRuby} input="" picked={null} hasError={false} onPick={noop} onAdvance={noop} />
);
