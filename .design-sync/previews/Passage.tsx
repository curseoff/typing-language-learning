import { Passage } from '@tll/ui';
// 下部本文フロー。seg は type/canonical/variants（＋和文は ja/kana）。buildPassage は app 側 domain
// なので @tll/ui からは来ない → 出題相当のセグメント列を手で組む。
const segments = [
  { type: 'en', canonical: 'good morning', variants: ['good morning'] },
  { type: 'ja', ja: 'おはよう', kana: 'おはよう', canonical: 'ohayou', variants: ['ohayou'] },
  { type: 'en', canonical: 'dictionary', variants: ['dictionary'] },
  { type: 'ja', ja: '辞書', kana: 'じしょ', canonical: 'jisho', variants: ['jisho', 'zisyo'] },
  { type: 'en', canonical: 'picture', variants: ['picture'] },
];
export const Typing = () => (
  <Passage segments={segments} segIndex={2} segInput="dic" completed={{}} hasError={false} />
);
export const Error = () => (
  <Passage segments={segments} segIndex={2} segInput="dix" completed={{}} hasError={true} />
);
