import { TopFlow, buildPassage } from 'typing-language-learning';
const pool = [
  { word: 'travel', en: 'travel', ja: '旅行', kana: 'りょこう' },
  { word: 'dictionary', en: 'dictionary', ja: '辞書', kana: 'じしょ' },
  { word: 'picture', en: 'picture', ja: '写真', kana: 'しゃしん' },
];
const segs = buildPassage('both', pool, { target: 60 });
export const Wrap = () => <TopFlow segments={segs} segIndex={2} segInput="pi" hasError={false} />;
export const Ticker = () => <TopFlow segments={segs} segIndex={2} segInput="pi" hasError={false} ticker={true} />;
