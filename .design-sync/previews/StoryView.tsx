import { StoryView } from 'typing-language-learning';
const noop = () => {};
const modeLabel = (m) => ({ both: '英語・日本語', en: '英語', ja: '日本語' }[m] ?? m);
export const Play = () => (
  <StoryView mode="both" modeLabel={modeLabel} storyId="travel" start="arrive" onExit={noop} />
);
