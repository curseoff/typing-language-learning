import { TranslateView, buildPassage } from 'typing-language-learning';
const pool = [
  { word: 'travel', en: 'travel', ja: '旅行', kana: 'りょこう' },
  { word: 'dictionary', en: 'dictionary', ja: '辞書', kana: 'じしょ' },
];
const segs = buildPassage('en-tr', pool, { target: 30 });
export const ToEnglish = () => <TranslateView segments={segs} segIndex={0} segInput="" hasError={false} />;
