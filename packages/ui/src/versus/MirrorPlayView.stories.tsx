import type { Meta, StoryObj } from '@storybook/react-vite';
import { MirrorPlayView } from '@tll/ui';
import type { TopSeg } from '@tll/ui';

// #439 道Y：相手の入力盤面を「本物の TopFlow」で複製する共有 presenter（英英/単語/単語例文で共用）。
// あなたの入力盤面（DictTypeView/WordTypeView/MarathonView）と同じ TopFlow（スライド／2問カルーセル／青枠）で描き、
// 答え側（answerSide）の行だけを全面伏字（実文字を出さない）にする。進捗は相手から届く curPos から導く。
const meta = {
  title: 'versus/MirrorPlayView',
  component: MirrorPlayView,
} satisfies Meta<typeof MirrorPlayView>;
export default meta;
type Story = StoryObj<typeof meta>;

// 英英（en モード）の問題列。en=定義（答え＝伏字）、ja/kana=見出し語の和訳（ヒント）。
const dictEnSegs: TopSeg[] = [
  { type: 'en', en: 'a round fruit with red or green skin', ja: '赤か緑の皮の丸い果物', kana: 'あかかみどりのかわのまるいくだもの', sentenceIndex: 0 },
  { type: 'en', en: 'the star that the earth moves around', ja: '地球が回る星', kana: 'ちきゅうがまわるほし', sentenceIndex: 1 },
  { type: 'en', en: 'a book that lists words and their meanings', ja: '語と意味を並べた本', kana: 'ごといみをならべたほん', sentenceIndex: 2 },
];

// 英英（ja モード）：答え＝和訳（伏字＝ふりがなごと隠す）、ヒント＝英語定義（実テキスト）。
const dictJaSegs: TopSeg[] = [
  { type: 'ja', en: 'a round fruit with red or green skin', ja: '果物', kana: 'くだもの', sentenceIndex: 0 },
  { type: 'ja', en: 'the star that the earth moves around', ja: '太陽', kana: 'たいよう', sentenceIndex: 1 },
];

// 単語モード：1 語＝1 問（見出し語なし）。en=英単語（答え＝伏字）、ja/kana=和訳（ヒント）。
const wordSegs: TopSeg[] = [
  { type: 'en', en: 'apple', ja: 'りんご', kana: 'りんご', sentenceIndex: 0 },
  { type: 'en', en: 'sun', ja: '太陽', kana: 'たいよう', sentenceIndex: 1 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 2 },
];

// both（英語・日本語）モード：1 語＝en/ja の 2 seg（同一 sentenceIndex のペア）。
// typedSide に依らず「英語行＝伏字／日本語行＝実表示（問題文を全表示）」に統一する（#439 道Y (4)）。
const wordBothSegs: TopSeg[] = [
  { type: 'en', en: 'apple', ja: 'りんご', kana: 'りんご', sentenceIndex: 0 },
  { type: 'ja', en: 'apple', ja: 'りんご', kana: 'りんご', sentenceIndex: 0 },
  { type: 'en', en: 'sun', ja: '太陽', kana: 'たいよう', sentenceIndex: 1 },
  { type: 'ja', en: 'sun', ja: '太陽', kana: 'たいよう', sentenceIndex: 1 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 2 },
  { type: 'ja', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 2 },
];

// en モード（英英）：答え側＝英語定義（伏字）、ヒント＝日本語（見出し和訳あり）。現在問題は8文字ぶん打鍵済み。
export const En: Story = {
  args: { segments: dictEnSegs, segIndex: 1, answerSide: 'en', curPos: 8, word: 'sun', wordJa: '太陽' },
};

// ja モード（英英）：答え側＝和訳（伏字・見出し和訳は隠す＝答えになるため）、ヒント＝英語定義（実テキスト）。
export const Ja: Story = {
  args: { segments: dictJaSegs, segIndex: 1, answerSide: 'ja', curPos: 2, word: 'sun', wordJa: '太陽' },
};

// 単語モード：見出し語なし（word 未指定）。英単語（伏字）＋和訳ヒント。
export const Word: Story = {
  args: { segments: wordSegs, segIndex: 2, answerSide: 'en', curPos: 4 },
};

// both×英語入力中（typedSide='en'）：英語行＝伏字（curPos 分 filled）、日本語行＝実表示（問題文を全表示）。
export const BothTypingEn: Story = {
  args: { segments: wordBothSegs, segIndex: 2, answerSide: 'en', curPos: 4 },
};

// both×日本語入力中（typedSide='ja'）：英語行＝伏字（英語は入力済み＝全 filled）、日本語行＝実表示（進捗着色）。
// （#439 本人スクショ#15 の不具合＝日本語入力中に日本語が出ず英語が実表示、を直したケース。）
export const BothTypingJa: Story = {
  args: { segments: wordBothSegs, segIndex: 3, answerSide: 'ja', curPos: 2 },
};

// ミス中（答え側の今打つマスが赤）。
export const Miss: Story = {
  args: { segments: dictEnSegs, segIndex: 1, answerSide: 'en', curPos: 6, miss: true, word: 'sun', wordJa: '太陽' },
};

// 狭幅（320px）：伏字・ヒント文がティッカー内に収まることを確認する。
export const Narrow320: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <MirrorPlayView segments={dictEnSegs} segIndex={2} answerSide="en" curPos={13} word="dictionary" wordJa="辞書" />
    </div>
  ),
};
