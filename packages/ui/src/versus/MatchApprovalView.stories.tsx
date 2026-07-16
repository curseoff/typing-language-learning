import type { Meta, StoryObj } from '@storybook/react-vite';
import { MatchApprovalView } from '@tll/ui';

// 設定案の承認 UI。承認側/提案側・拒否バナー・投票状況を代表 props で描く。
const meta = {
  title: 'versus/MatchApprovalView',
  component: MatchApprovalView,
} satisfies Meta<typeof MatchApprovalView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const SELF_ID = '03ecf8d2-1111-4a2b-9c3d-aaaaaaaaaaaa';
const PEER_ID = '77bd90ac-2222-4f5e-8d6c-bbbbbbbbbbbb';

const proposal = {
  gameType: '穴埋め',
  level: 3,
  theme: '日常',
  mode: 'ノーマル',
  endConditionLabel: '60秒',
};

// 承認側：この設定で対戦するかを選ぶ
export const ToApprove: Story = {
  render: () => (
    <MatchApprovalView
      proposal={proposal}
      proposerId={PEER_ID}
      isProposer={false}
      onAccept={noop}
      onReject={noop}
    />
  ),
};

// 提案側：相手の承認待ち（ボタンなし）
export const Proposer: Story = {
  render: () => (
    <MatchApprovalView
      proposal={proposal}
      proposerId={SELF_ID}
      isProposer
      votes={{ [SELF_ID]: 'accept', [PEER_ID]: 'pending' }}
      onAccept={noop}
      onReject={noop}
    />
  ),
};

// 拒否されて差し戻し（提案側に赤系バナー）
export const Rejected: Story = {
  render: () => (
    <MatchApprovalView
      proposal={proposal}
      proposerId={SELF_ID}
      isProposer
      rejection={{ by: [PEER_ID] }}
      onAccept={noop}
      onReject={noop}
    />
  ),
};
