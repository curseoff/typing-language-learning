import { RecordDetail } from 'typing-language-learning';
const noop = () => {};
const segStats = [
  { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
  { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
  { no: 3, label: 'travel', answer: '旅行', correct: true, mistakes: 1 },
];
const rec = {
  source: 'words', seed: 12345, keys: 240, speed: 240, correct: 18, words: 20,
  mistakes: 5, accuracy: 98, seconds: 60, endLabel: '60秒', date: '2026-07-05 21:00',
  segStats, choices: [],
};
const older = { ...rec, date: '2026-07-04 10:00', accuracy: 95, keys: 210, speed: 210, correct: 16 };
// .record-page は position:fixed の全画面オーバーレイ。transform で包含ブロックを作り、
// 高さ固定の器の中に収めてカードに収まるようにする。
export const Detail = () => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', height: 760, overflow: 'auto' }}>
    <RecordDetail list={[rec, older]} initial={{ record: rec, position: 1 }}
      rankText="単語 L1 / すべて" modeKey="quiz-ja" hasEnding={false} onClose={noop} />
  </div>
);
