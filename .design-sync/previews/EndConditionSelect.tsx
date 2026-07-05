import { EndConditionSelect } from 'typing-language-learning';
const noop = () => {};
export const TimeMode = () => (
  <EndConditionSelect endCondition={{ kind: 'time', value: 60 }} onChange={noop} focusSection="end" onFocusSection={noop} />
);
export const CharsMode = () => (
  <EndConditionSelect endCondition={{ kind: 'chars', value: 600 }} onChange={noop} focusSection="end" onFocusSection={noop} />
);
export const Endless = () => (
  <EndConditionSelect endCondition={{ kind: 'endless', value: null }} onChange={noop} focusSection="endKind" onFocusSection={noop} />
);
