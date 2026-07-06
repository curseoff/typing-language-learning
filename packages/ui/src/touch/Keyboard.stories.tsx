import type { Meta, StoryObj } from '@storybook/react-vite';
import { Keyboard } from '@tll/ui';

const meta = {
  title: 'touch/Keyboard',
  component: Keyboard,
} satisfies Meta<typeof Keyboard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Highlight: Story = { render: () => <Keyboard target="f" hasError={false} showTarget={true} /> };
export const Blind: Story = { render: () => <Keyboard target="j" hasError={false} showTarget={false} /> };
export const Miss: Story = {
  render: () => (
    <Keyboard target="d" hasError={true} wrongKey="s" pressed={{ key: 's', tick: 1 }} showTarget={true} />
  ),
};
