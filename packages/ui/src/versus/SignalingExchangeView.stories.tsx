import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignalingExchangeView } from '@tll/ui';

// 接続コード交換（手動シグナリング・QR なし＝コピペ＋共有URL）。各状態を代表 props で描く。
const meta = {
  title: 'versus/SignalingExchangeView',
  component: SignalingExchangeView,
} satisfies Meta<typeof SignalingExchangeView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const SAMPLE_CODE =
  'eJyrVkrLzClJLVKyUsrPS8vMSQ0oykxOTS7JzM9TslJKzMlJTQEA-code-sample-1234567890';
const SHARE_URL = 'https://example.com/app/#versus=' + SAMPLE_CODE;

const common = {
  selfId: 'me-1234',
  onSelectHost: noop,
  onSelectGuest: noop,
  onSubmitOffer: noop,
  onSubmitAnswer: noop,
  onCopy: noop,
  onBack: noop,
};

// 役割選択（未接続）
export const RoleSelect: Story = {
  render: () => <SignalingExchangeView {...common} role={null} connection="idle" />,
};

// ホスト：接続コードと共有URLを提示（応答待ち）
export const HostOffer: Story = {
  render: () => (
    <SignalingExchangeView
      {...common}
      role="host"
      connection="connecting"
      offerCode={SAMPLE_CODE}
      shareUrl={SHARE_URL}
    />
  ),
};

// ゲスト：応答コードを提示（ホストの受理待ち）
export const GuestAnswer: Story = {
  render: () => (
    <SignalingExchangeView
      {...common}
      role="guest"
      connection="connecting"
      answerCode={SAMPLE_CODE}
    />
  ),
};

// 接続済み（参加者一覧）
export const Connected: Story = {
  render: () => (
    <SignalingExchangeView
      {...common}
      role="host"
      connection="connected"
      activeIds={['me-1234', 'peer-abcd']}
    />
  ),
};

// エラー表示（コード不正）
export const WithError: Story = {
  render: () => (
    <SignalingExchangeView
      {...common}
      role="host"
      connection="connecting"
      offerCode={SAMPLE_CODE}
      shareUrl={SHARE_URL}
      error="応答コードが正しくありません"
    />
  ),
};
