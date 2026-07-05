import { Result } from 'typing-language-learning';
const noop = () => {};
const records = new Proxy({}, { get: () => [] });
const base = {
  source: 'words', mode: 'both', rank: 1, theme: 'すべて',
  keys: 240, speed: 240, mistakes: 5, accuracy: 98, correctCount: 20, seconds: 60,
  date: '2026-07-05 21:00',
};
const time = { ...base, endCondition: { kind: 'time', value: 60 } };
const items = { ...base, mode: 'quiz-ja', correctCount: 23, endCondition: { kind: 'items', value: 25 } };
export const Summary = () => <Result result={time} records={records} segStats={[]} onRetry={noop} />;
export const QuizItems = () => <Result result={items} records={records} segStats={[]} onRetry={noop} />;
