import { Flow } from 'typing-language-learning';
const items = [
  { en: 'Good morning', ja: 'おはよう', kana: 'おはよう' },
  { en: 'How are you?', ja: '元気ですか', kana: 'げんきですか' },
];
export const Wrap = () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa />;
export const Ticker = () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" ticker showEn showJa />;
export const EnglishOnly = () => <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa={false} />;
