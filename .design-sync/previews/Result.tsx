import { Result } from 'typing-language-learning';
const noop = () => {};
const records = new Proxy({}, { get: () => [] });
const result = {
  source: 'words', mode: 'both', rank: 1, theme: 'すべて',
  endCondition: { kind: 'time', value: 60 },
  keys: 240, speed: 240, mistakes: 5, accuracy: 98, correctCount: 20, seconds: 60,
  date: '2026-07-05 21:00',
};
export const Summary = () => <Result result={result} records={records} segStats={[]} onRetry={noop} />;
