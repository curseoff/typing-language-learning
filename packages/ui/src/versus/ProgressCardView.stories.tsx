import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressCardView } from '@tll/ui';

// 対戦中の 1 人ぶんの進捗カード。自分/相手・サドンデス（ライフ）有無を代表 props で描く。
const meta = {
  title: 'versus/ProgressCardView',
  component: ProgressCardView,
} satisfies Meta<typeof ProgressCardView>;
export default meta;
type Story = StoryObj<typeof meta>;

const SELF_ID = '03ecf8d2-1111-4a2b-9c3d-aaaaaaaaaaaa';
const PEER_ID = '77bd90ac-2222-4f5e-8d6c-bbbbbbbbbbbb';

// 自分（強調枠）
export const Self: Story = {
  render: () => (
    <ProgressCardView
      id={SELF_ID}
      self
      typed={128}
      speed={312}
      mistakes={4}
      elapsedSec={42}
      correct={7}
    />
  ),
};

// 相手（時間終了条件＝経過/制限秒を表示）
export const OpponentTimed: Story = {
  render: () => (
    <ProgressCardView
      id={PEER_ID}
      name="ゲスト"
      self={false}
      typed={96}
      speed={240}
      mistakes={9}
      elapsedSec={42}
      limitSec={60}
      correct={5}
    />
  ),
};

// サドンデス（残ライフをハートで表示）
export const SuddenDeath: Story = {
  render: () => (
    <ProgressCardView
      id={SELF_ID}
      self
      typed={210}
      speed={360}
      mistakes={2}
      elapsedSec={88}
      correct={11}
      lives={3}
    />
  ),
};
