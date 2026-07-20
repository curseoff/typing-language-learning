import type { Meta, StoryObj } from '@storybook/react-vite';
import { MaskBoard } from '@tll/ui';
import type { MaskBoardCell } from '@tll/ui';

// #439 相手の答え側盤面の伏字複製。answerShape=[2,4,4] を curPos ぶん filled にした構造マス列を代表 props で描く。
const meta = {
  title: 'versus/MaskBoard',
  component: MaskBoard,
} satisfies Meta<typeof MaskBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

// answerShape=[2,4,4] を curPos 個 filled・語間 space・残り pending へ展開したマス列（domain maskBoardCells 相当）。
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

// 入力途中（3 文字済み・to make food 相当の語構造）
export const Typing: Story = {
  render: () => <MaskBoard cells={cellsFor([2, 4, 4], 3)} />,
};

// 未入力（全 pending）
export const Empty: Story = {
  render: () => <MaskBoard cells={cellsFor([5], 0)} />,
};

// ミス中（済みマスを赤）
export const Miss: Story = {
  render: () => <MaskBoard cells={cellsFor([5], 2, true)} />,
};

// 満杯（全 filled）
export const Full: Story = {
  render: () => <MaskBoard cells={cellsFor([2, 4, 4], 10)} />,
};
