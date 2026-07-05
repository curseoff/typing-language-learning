import { TouchView } from 'typing-language-learning';
const noop = () => {};
export const Easy = () => (
  <TouchView level="home" levelLabel="ホームポジション" mode="easy" modeLabel="やさしい" onRecord={noop} onExit={noop} />
);
export const Hard = () => (
  <TouchView level="top" levelLabel="上段" mode="hard" modeLabel="むずかしい" onRecord={noop} onExit={noop} />
);
