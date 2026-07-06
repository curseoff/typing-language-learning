import type { Meta, StoryObj } from '@storybook/react-vite';
import { SoundToggle } from '@tll/ui';

// position:fixed の固定ボタン。単体で見えるよう相対配置の器に入れる。muted/onToggle を props で受ける。
const meta = {
  title: 'sound/SoundToggle',
  component: SoundToggle,
} satisfies Meta<typeof SoundToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const On: Story = {
  render: () => (
    <div style={{ position: 'relative', height: 64 }}>
      <SoundToggle muted={false} onToggle={noop} />
    </div>
  ),
};
export const Muted: Story = {
  render: () => (
    <div style={{ position: 'relative', height: 64 }}>
      <SoundToggle muted={true} onToggle={noop} />
    </div>
  ),
};
