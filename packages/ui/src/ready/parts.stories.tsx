import type { Meta, StoryObj } from '@storybook/react-vite';
import { ModeButtons, SectionLabel, BottomTabs, StartRow } from '@tll/ui';

const meta = {
  title: 'ready/parts',
  component: SectionLabel,
} satisfies Meta<typeof SectionLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const modes = [
  { key: 'both', label: '英語・日本語' },
  { key: 'en', label: '英語' },
  { key: 'ja', label: '日本語' },
];

export const ModeButtonsSelected: Story = {
  render: () => <ModeButtons modes={modes} value="both" onChange={noop} focused={true} />,
};
export const ModeButtonsUnfocused: Story = {
  render: () => <ModeButtons modes={modes} value="en" onChange={noop} focused={false} />,
};
export const Label: Story = { render: () => <SectionLabel>レベル</SectionLabel> };
export const BottomTabsRecords: Story = {
  render: () => <BottomTabs value="records" onChange={noop} focused={true} />,
};
export const BottomTabsList: Story = {
  render: () => <BottomTabs value="list" onChange={noop} focused={false} />,
};
export const StartRowDefault: Story = { render: () => <StartRow onStart={() => {}} /> };
