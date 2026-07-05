import { MarathonView, buildPassage } from 'typing-language-learning';
const pool = [
  { word: 'travel', en: 'travel', ja: '旅行', kana: 'りょこう' },
  { word: 'dictionary', en: 'dictionary', ja: '辞書', kana: 'じしょ' },
  { word: 'picture', en: 'picture', ja: '写真', kana: 'しゃしん' },
];
const segs = buildPassage('both', pool, { target: 80 });
const common = { mode: 'both', rankText: '単語 L1 / すべて', gloss: {}, segments: segs, segIndex: 1, segInput: 'ryo', hasError: false, typedKeys: 42, mistakes: 2, missedItems: 0, liveSpeed: 210, elapsedSec: 18 };
export const Timed = () => <MarathonView {...common} endCondition={{ kind: 'time', value: 60 }} />;
export const Endless = () => <MarathonView {...common} endCondition={{ kind: 'endless', value: null }} />;
