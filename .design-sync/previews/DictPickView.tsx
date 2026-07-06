import { DictPickView } from '@tll/ui';
// 英英辞典の説明文4択 presenter（プレイ中）。見出し語を見て正しい説明文を選ぶ。
const noop = () => {};
const options = [
  { display: 'a book that lists words and their meanings', variants: ['a'], answer: true },
  { display: 'a painting, drawing, or photograph', variants: ['a'] },
  { display: 'the act of going from one place to another', variants: ['the'] },
];
export const Prompt = () => (
  <DictPickView levelLabel="英英 L1" metaSub="説明（4択） / すべて" finished={false} resultNode={null}
    typedKeys={18} correct={4} mistakes={2} endStatLabel="残り" endStatValue="12問" progress={0.45}
    prompt="dictionary" headJa="辞書" options={options} input="" picked={null} hasError={false} onPick={noop} onAdvance={noop} />
);
