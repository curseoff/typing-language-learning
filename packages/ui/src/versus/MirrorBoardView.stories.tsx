import type { Meta, StoryObj } from '@storybook/react-vite';
import { MirrorBoardView } from '@tll/ui';
import type { MaskBoardCell } from '@tll/ui';

// #439 相手1人ぶんの盤面複製。見出し語ヘッダ＋英語/日本語の2段（答え側=伏字マス／ヒント側=実テキスト）。
const meta = {
  title: 'versus/MirrorBoardView',
  component: MirrorBoardView,
} satisfies Meta<typeof MirrorBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

function cellsFor(shape: number[], curPos: number, miss = false): MaskBoardCell[] {
  const sum = shape.reduce((a, b) => a + b, 0);
  const filled = Math.max(0, Math.min(curPos, sum));
  const out: MaskBoardCell[] = [];
  let idx = 0;
  shape.forEach((len, wi) => {
    if (wi > 0) out.push({ kind: 'space', miss });
    for (let i = 0; i < len; i += 1) {
      out.push({ kind: idx < filled ? 'filled' : 'pending', miss });
      idx += 1;
    }
  });
  return out;
}

// 英英 en モード：答え側=英語定義（伏字）、ヒント=日本語（見出し和訳あり）。
export const DictEn: Story = {
  render: () => (
    <MirrorBoardView
      word="apple"
      wordJa="りんご"
      answerSide="en"
      hint={{ side: 'ja', text: '果物の一種' }}
      cells={cellsFor([2, 4, 4], 3)}
    />
  ),
};

// 英英 ja モード：答え側=和訳（伏字・見出し和訳は隠す）、ヒント=英語定義（実テキスト）。
export const DictJa: Story = {
  render: () => (
    <MirrorBoardView
      word="sun"
      answerSide="ja"
      hint={{ side: 'en', text: 'the star that the earth moves around' }}
      cells={cellsFor([4], 2)}
    />
  ),
};

// 日本語ヒントにルビ（読み補助・答え側ではないので出してよい）。
export const JaHintWithRuby: Story = {
  render: () => (
    <MirrorBoardView
      word="太陽"
      answerSide="en"
      hint={{ side: 'ja', text: '太陽', kana: 'たいよう' }}
      cells={cellsFor([3], 1)}
    />
  ),
};

// ミス中（答え側の済みマスが赤）。
export const Miss: Story = {
  render: () => (
    <MirrorBoardView
      word="apple"
      wordJa="りんご"
      answerSide="en"
      hint={{ side: 'ja', text: '果物の一種' }}
      cells={cellsFor([5], 2, true)}
    />
  ),
};
