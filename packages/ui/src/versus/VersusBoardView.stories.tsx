import type { Meta, StoryObj } from '@storybook/react-vite';
import { VersusBoardView } from '@tll/ui';
import type { ProgressCardData } from '@tll/ui';

// 対戦盤面。進行中/順位確定（単独）/同点（同順位）の各状態を代表 props で描く。
// 勝敗は上部バッジではなく各カード内の順位（rank）で示す（container が算出して members に載せる）。
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

// 進行中（順位・完了バッジなし）
export const InProgress: Story = {
  render: () => <VersusBoardView members={members} />,
};

// 順位確定（自分1位・相手2位）＝各カードに順位/完了を表示
export const Ranked: Story = {
  render: () => (
    <VersusBoardView
      members={members.map((m) => ({
        ...m,
        finished: true,
        rank: m.id === SELF_ID ? 1 : 2,
      }))}
    />
  ),
};

// 同点（同順位＝両者1位）
export const Draw: Story = {
  render: () => (
    <VersusBoardView members={members.map((m) => ({ ...m, finished: true, rank: 1 }))} />
  ),
};
