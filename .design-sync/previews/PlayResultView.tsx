import { PlayResultView } from '@tll/ui';
// 単語／英英のプレイ結果 presenter。主成績は result.endCondition.kind から導出。記録詳細モーダルは container。
const noop = () => {};
const list = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, date: '2026-07-04 10:00' },
  { keys: 180, speed: 180, correctCount: 18, accuracy: 92, seconds: 60, date: '2026-07-03 09:30' },
];
const segStats = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
];
const handlers = { onRetry: noop, onExit: noop, onRowClick: noop };
export const Timed = () => (
  <PlayResultView isQuiz={false}
    result={{ endCondition: { kind: 'time', value: 60 }, keys: 240, speed: 240, mistakes: 5, accuracy: 98, seconds: 60, date: '2026-07-05 21:00', segStats }}
    list={list} {...handlers} />
);
export const QuizItems = () => (
  <PlayResultView isQuiz={true}
    result={{ endCondition: { kind: 'items', value: 25 }, correctCount: 23, accuracy: 96, seconds: 72, correct: 23, words: 25, mistakes: 3, date: '2026-07-05 21:00', segStats }}
    list={list} {...handlers} />
);
