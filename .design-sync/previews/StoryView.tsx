import { StoryView } from '@tll/ui';
// 物語モードの画面 presenter（フラット props）。プレイ中（本文入力）と分岐選択、エンディングを描く。
const noop = () => {};
const flowItems = [{ en: 'You arrive at the small station.', ja: '小さな駅に着く', kana: 'ちいさなえきにつく', sentenceIndex: 0 }];
const base = {
  storyTitle: '旅の物語',
  modeLabel: '英語・日本語',
  foundCount: 2,
  endingCount: 5,
  hasError: false,
  onRestart: noop,
  onExit: noop,
  typedKeys: 128,
  liveSpeed: 210,
  mistakes: 4,
  elapsedSec: 46,
  barProgress: 0.6,
  isBoth: true,
  activeInput: null,
  choices: null,
};
export const Text = () => (
  <StoryView {...base} stage="text" showFlow flowItems={flowItems}
    enDone={9} jaDone={0} jaKanaDone={0} activeRow="en"
    unitProgress={{ current: 3, total: 8, typeLabel: '英語・日本語' }} />
);
export const Choice = () => (
  <StoryView {...base} stage="choice" showFlow={false} flowItems={[]}
    enDone={0} jaDone={0} jaKanaDone={0} activeRow={null} unitProgress={null}
    choices={[
      { key: 'a', lang: 'en', en: 'Take the north road', ja: '北の道へ', matched: true, enDone: 4, enCursor: 4, jaDone: 0, hasError: false },
      { key: 'b', lang: 'en', en: 'Rest at the inn', ja: '宿で休む', matched: false, enDone: 0, enCursor: 0, jaDone: 0, hasError: false },
    ]} />
);
export const Ending = () => (
  <StoryView {...base} stage="ending" showFlow={false} flowItems={[]}
    enDone={0} jaDone={0} jaKanaDone={0} activeRow={null} unitProgress={null}
    endLabel="🌅 夜明けエンド" endEn="You reach the summit at dawn." endJa="夜明けに頂へ辿り着いた。"
    result={{ speed: 210, keys: 480, seconds: 92, mistakes: 6, accuracy: 97 }}
    segStats={[
      { no: 1, label: 'station', answer: '駅', correct: true, mistakes: 0 },
      { no: 2, label: 'road', answer: '道', correct: false, mistakes: 2 },
    ]} />
);
