import { WordSentenceSection } from 'typing-language-learning';
const noop = () => {};
const records = new Proxy({}, { get: () => [] });
export const Records = () => (
  <WordSentenceSection mode="both" wsentLevel={1} wsentTheme="すべて" bottomTab="records"
    records={records} endCondition={{ kind: 'time', value: 60 }} focusSection="mode"
    onModeChange={noop} onWsentLevelChange={noop} onWsentThemeChange={noop}
    onFocusSection={noop} onBottomTabChange={noop} onStart={noop} onEndConditionChange={noop} />
);
