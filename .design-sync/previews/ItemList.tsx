import { ItemList } from 'typing-language-learning';
const words = [
  { en: 'dictionary', ja: '辞書', freq: 1200 },
  { en: 'picture', ja: '写真', freq: 800 },
  { en: 'travel', ja: '旅行', freq: 500 },
];
const dicts = [
  { word: 'dictionary', def: 'a book that lists words and their meanings', ja: '辞書' },
  { word: 'picture', def: 'a painting, drawing, or photograph', ja: '写真' },
];
export const Words = () => <ItemList items={words} type="words" mode="normal" />;
export const Dictionary = () => <ItemList items={dicts} type="dict" mode="normal" />;
export const QuizMode = () => <ItemList items={words} type="words" mode="quiz" />;
