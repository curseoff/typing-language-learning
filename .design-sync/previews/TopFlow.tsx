import { TopFlow } from '@tll/ui';
// 上部二段フロー（英語／日本語）。TopSeg は type/ja/en/kana/sentenceIndex。both 相当に組む。
const segments = [
  { type: 'en', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'ja', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'ja', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'en', en: 'picture', ja: '写真', kana: 'しゃしん', sentenceIndex: 2 },
];
export const EnglishTyping = () => <TopFlow segments={segments} segIndex={2} segInput="dic" hasError={false} />;
export const JapaneseTyping = () => <TopFlow segments={segments} segIndex={3} segInput="ji" hasError={false} />;
export const Ticker = () => <TopFlow segments={segments} segIndex={2} segInput="dic" hasError={false} ticker={true} />;
