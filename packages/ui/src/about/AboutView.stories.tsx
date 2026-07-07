import type { Meta, StoryObj } from '@storybook/react-vite';
import { AboutView } from '@tll/ui';

// 紹介ページ（LP）の presenter。硬派・シンプルな独立ページ。
const meta = {
  title: 'about/AboutView',
  component: AboutView,
} satisfies Meta<typeof AboutView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AboutView onStart={() => {}} />,
};
