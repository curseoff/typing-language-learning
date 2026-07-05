import { TouchSection } from 'typing-language-learning';
const noop = () => {};
const records = new Proxy({}, { get: () => [] });
export const Easy = () => (
  <TouchSection touchLevel="home" touchMode="easy" focusSection="mode"
    onTouchLevelChange={noop} onTouchModeChange={noop} onFocusSection={noop} onStart={noop} records={records} />
);
export const Hard = () => (
  <TouchSection touchLevel="top" touchMode="hard" focusSection="level"
    onTouchLevelChange={noop} onTouchModeChange={noop} onFocusSection={noop} onStart={noop} records={records} />
);
