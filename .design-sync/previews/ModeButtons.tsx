import { ModeButtons } from 'typing-language-learning';
const noop = () => {};
const modes = [
  { key: 'both', label: '英語・日本語' },
  { key: 'en', label: '英語' },
  { key: 'ja', label: '日本語' },
];
export const Selected = () => <ModeButtons modes={modes} value="both" onChange={noop} focused={true} />;
export const Unfocused = () => <ModeButtons modes={modes} value="en" onChange={noop} focused={false} />;
