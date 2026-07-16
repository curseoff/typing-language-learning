import type { Meta, StoryObj } from '@storybook/react-vite';
import { VersusBoardView } from '@tll/ui';
import type { ProgressCardData } from '@tll/ui';

// 対戦盤面。進行中/勝者確定/ドローの各状態を代表 props で描く。
const meta = {
  title: 'versus/VersusBoardView',
  component: VersusBoardView,
} satisfies Meta<typeof VersusBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

const SELF_ID = '03ecf8d2-1111-4a2b-9c3d-aaaaaaaaaaaa';
const PEER_ID = '77bd90ac-2222-4f5e-8d6c-bbbbbbbbbbbb';

const members: ProgressCardData[] = [
  { id: SELF_ID, self: true, typed: 128, speed: 312, mistakes: 4, elapsedSec: 42, correct: 7 },
  { id: PEER_ID, name: 'ゲスト', self: false, typed: 96, speed: 240, mistakes: 9, elapsedSec: 42, correct: 5 },
];

// 進行中（バッジなし）
export const InProgress: Story = {
  render: () => <VersusBoardView members={members} />,
};

// 勝者確定
export const Winner: Story = {
  render: () => <VersusBoardView members={members} finished winners={[SELF_ID]} />,
};

// ドロー（勝者が複数）
export const Draw: Story = {
  render: () => <VersusBoardView members={members} finished winners={[SELF_ID, PEER_ID]} />,
};
