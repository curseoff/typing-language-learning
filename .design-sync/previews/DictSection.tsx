import { DictSection } from 'typing-language-learning';
const noop = () => {};
export const Records = () => (
  <DictSection dictLevel={1} dictTheme="すべて" dictMode="both" bottomTab="records"
    endCondition={{ kind: 'time', value: 60 }} focusSection="mode"
    onDictLevelChange={noop} onDictThemeChange={noop} onDictModeChange={noop}
    onFocusSection={noop} onBottomTabChange={noop} onStart={noop} onEndConditionChange={noop} />
);
