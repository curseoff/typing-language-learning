import { Ready } from 'typing-language-learning';
const noop = () => {};
const records = new Proxy({}, { get: () => [] });
const base = {
  onTypeChange: noop, mode: 'both', onModeChange: noop,
  storyId: 'travel', onStoryIdChange: noop,
  wsentLevel: 1, onWsentLevelChange: noop, wsentTheme: 'すべて', onWsentThemeChange: noop,
  wordLevel: 1, wordTheme: 'すべて', wordMode: 'both',
  onWordLevelChange: noop, onThemeChange: noop, onWordModeChange: noop,
  dictLevel: 1, dictTheme: 'すべて', dictMode: 'both',
  onDictLevelChange: noop, onDictThemeChange: noop, onDictModeChange: noop,
  touchLevel: 'home', onTouchLevelChange: noop, touchMode: 'easy', onTouchModeChange: noop,
  focusSection: 'type', onFocusSection: noop,
  bottomTab: 'records', onBottomTabChange: noop, onStart: noop,
  records, endCondition: { kind: 'time', value: 60 }, onEndConditionChange: noop,
};
export const WordsTab = () => <Ready gameType="words" {...base} />;
export const TouchTab = () => <Ready gameType="touch" {...base} />;
export const DictTab = () => <Ready gameType="dict" {...base} />;
