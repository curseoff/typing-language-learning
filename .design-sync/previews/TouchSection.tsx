import { TouchSection } from 'typing-language-learning';
const noop = () => {};
const records = new Proxy({}, { get: () => [] });
const base = { onTouchLevelChange: noop, onTouchModeChange: noop, onFocusSection: noop, onStart: noop, records };
export const Easy = () => <TouchSection touchLevel="home" touchMode="easy" focusSection="mode" {...base} />;
export const Hard = () => <TouchSection touchLevel="top" touchMode="hard" focusSection="level" {...base} />;
export const NumberRange = () => <TouchSection touchLevel="number" touchMode="easy" focusSection="level" {...base} />;
