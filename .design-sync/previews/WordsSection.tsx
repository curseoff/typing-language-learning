import { WordsSection } from 'typing-language-learning';
const noop = () => {};
export const Records = () => (
  <WordsSection wordLevel={1} wordTheme="すべて" wordMode="both" bottomTab="records"
    endCondition={{ kind: 'time', value: 60 }} focusSection="mode"
    onWordLevelChange={noop} onThemeChange={noop} onWordModeChange={noop}
    onFocusSection={noop} onBottomTabChange={noop} onStart={noop} onEndConditionChange={noop} />
);
