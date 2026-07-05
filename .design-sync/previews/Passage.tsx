import { Passage, buildPassage } from 'typing-language-learning';
const pool = [
  { word: 'travel', en: 'travel', ja: '旅行', kana: 'りょこう' },
  { word: 'dictionary', en: 'dictionary', ja: '辞書', kana: 'じしょ' },
  { word: 'picture', en: 'picture', ja: '写真', kana: 'しゃしん' },
  { word: 'morning', en: 'morning', ja: '朝', kana: 'あさ' },
];
const segments = buildPassage('en', pool, { target: 50 });
export const Typing = () => (
  <Passage segments={segments} segIndex={2} segInput="pi" completed={{}} hasError={false} />
);
