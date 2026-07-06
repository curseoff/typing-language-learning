import { Flow } from '@tll/ui';
const items = [
  { en: 'Good morning', ja: 'おはよう', kana: 'おはよう' },
  { en: 'How are you?', ja: '元気ですか', kana: 'げんきですか' },
];
export const Wrap = () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa />;
export const Ticker = () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" ticker showEn showJa />;
export const EnglishOnly = () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa={false} />;
export const JapaneseTyping = () => <Flow items={items} cur={0} enDone={12} jaDone={2} jaKanaDone={2} activeRow="ja" wrap showEn showJa />;
