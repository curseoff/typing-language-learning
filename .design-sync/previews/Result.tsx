import { Result } from '@tll/ui';
// 単語例文の結果 presenter。records は解決済みの配列、modeText は container が解決した表示名を props で受ける。
const noop = () => {};
const recs = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, date: '2026-07-04 10:00' },
  { keys: 180, speed: 180, correctCount: 18, accuracy: 92, seconds: 60, date: '2026-07-03 09:30' },
];
const quiz = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
  { no: 3, label: 'travel', answer: '旅行', correct: true, mistakes: 1 },
];
const base = {
  mode: 'both', rank: 1, theme: 'すべて', source: 'wsent',
  keys: 240, speed: 240, mistakes: 5, accuracy: 98, correctCount: 20, seconds: 60,
  date: '2026-07-05 21:00',
};
export const Summary = () => (
  <Result result={{ ...base, endCondition: { kind: 'time', value: 60 } }} modeText="英語・日本語"
    segStats={[]} records={recs} onRetry={noop} />
);
export const QuizItems = () => (
  <Result result={{ ...base, mode: 'quiz-ja', correctCount: 23, endCondition: { kind: 'items', value: 25 } }}
    modeText="日本語（4択）" segStats={quiz} records={recs} onRetry={noop} />
);
