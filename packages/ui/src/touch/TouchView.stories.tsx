import type { Meta, StoryObj } from '@storybook/react-vite';
import { TouchView } from '@tll/ui';

// タッチタイピングのプレイ画面 presenter（フラット props）。プレイ中／完了を realistic に。
const meta = {
  title: 'touch/TouchView',
  component: TouchView,
} satisfies Meta<typeof TouchView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const common = {
  showTarget: true,
  typedKeys: 42,
  liveSpeed: 180,
  mistakes: 3,
  elapsedSec: 24,
  hasError: false,
  wrongKey: null,
  pressed: { key: null, tick: 0 },
  onRestart: noop,
  onExit: noop,
};
const targets = ['f', 'j', 'd', 'k', 's', 'l', 'a'];

export const Easy: Story = {
  render: () => (
    <TouchView levelLabel="ホームポジション" modeLabel="やさしい" targets={targets} index={2} target="d" finished={false} {...common} />
  ),
};
export const Miss: Story = {
  render: () => (
    <TouchView
      levelLabel="ホームポジション"
      modeLabel="やさしい"
      targets={targets}
      index={2}
      target="d"
      finished={false}
      {...common}
      hasError={true}
      wrongKey="s"
      pressed={{ key: 's', tick: 1, ok: false }}
    />
  ),
};
export const Finished: Story = {
  render: () => (
    <TouchView levelLabel="ホームポジション" modeLabel="やさしい" targets={targets} index={7} target="a" finished={true} {...common} />
  ),
};
