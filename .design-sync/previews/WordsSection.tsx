import { WordsSection } from 'typing-language-learning';
const noop = () => {};
const base = { onWordLevelChange: noop, onThemeChange: noop, onWordModeChange: noop, onFocusSection: noop, onBottomTabChange: noop, onStart: noop, onEndConditionChange: noop, endCondition: { kind: 'time', value: 60 }, focusSection: 'mode' };
export const Records = () => <WordsSection wordLevel={1} wordTheme="すべて" wordMode="both" bottomTab="records" {...base} />;
export const Quiz = () => <WordsSection wordLevel={4} wordTheme="ビジネス" wordMode="quiz-ja" bottomTab="records" {...base} />;
