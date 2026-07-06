import { WordTypeView } from '@tll/ui';
// 単語の入力モード presenter（プレイ中）。上部フロー＋HUD を描く。TopSeg 列を手で組む。
const segments = [
  { type: 'en', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'ja', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'ja', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
];
export const Typing = () => (
  <WordTypeView levelLabel="単語 L1" metaSub="英語・日本語 / すべて" finished={false} resultNode={null}
    typedKeys={84} liveSpeed={210} mistakes={2} endStatLabel="残り" endStatValue="24秒" progress={0.6}
    segments={segments} segIndex={2} segInput="dic" hasError={false} />
);
