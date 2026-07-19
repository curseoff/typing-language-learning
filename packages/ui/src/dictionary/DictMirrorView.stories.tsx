import type { Meta, StoryObj } from '@storybook/react-vite';
import { DictMirrorView } from '@tll/ui';
import type { MaskBoardCell } from '@tll/ui';

// #439 対戦：相手の英英盤面を伏字で静止複製する。あなたの入力盤面（DictTypeView）と同じ
// 見出し語＋英語/日本語の2段レイアウトで、答え側だけを伏字マス（実文字を出さない）で描く。
const meta = {
  title: 'dictionary/DictMirrorView',
  component: DictMirrorView,
} satisfies Meta<typeof DictMirrorView>;
export default meta;
type Story = StoryObj<typeof meta>;

// 語長配列＋打鍵位置から伏字マス列を作る（domain maskBoardCells 相当のストーリー用ヘルパ）。
function cellsFor(shape: number[], curPos: number, miss = false): MaskBoardCell[] {
  const sum = shape.reduce((a, b) => a + b, 0);
  const filled = Math.max(0, Math.min(curPos, sum));
  const out: MaskBoardCell[] = [];
  let idx = 0;
  shape.forEach((len, wi) => {
    if (wi > 0) out.push({ kind: 'space', miss });
    for (let i = 0; i < len; i += 1) {
      out.push({ kind: idx < filled ? 'filled' : 'pending', miss });
      idx += 1;
    }
  });
  return out;
}

// 英英 en モード：答え側＝英語定義（伏字）、ヒント＝日本語（見出し和訳あり）。
export const En: Story = {
  render: () => (
    <DictMirrorView
      levelLabel="L1"
      metaSub="英英 / 英語入力 / すべて"
      word="apple"
      wordJa="りんご"
      answerSide="en"
      hint={{ side: 'ja', text: '果物の一種' }}
      cells={cellsFor([1, 5, 4, 2, 3], 8)}
    />
  ),
};

// 英英 ja モード：答え側＝和訳（伏字・見出し和訳は隠す＝答えになるため）、ヒント＝英語定義（実テキスト）。
export const Ja: Story = {
  render: () => (
    <DictMirrorView
      levelLabel="L1"
      metaSub="英英 / 日本語入力 / すべて"
      word="sun"
      answerSide="ja"
      hint={{ side: 'en', text: 'the star that the earth moves around' }}
      cells={cellsFor([4], 2)}
    />
  ),
};

// ミス中（答え側の済みマスが赤）。
export const Miss: Story = {
  render: () => (
    <DictMirrorView
      levelLabel="L1"
      metaSub="英英 / 英語入力 / すべて"
      word="apple"
      wordJa="りんご"
      answerSide="en"
      hint={{ side: 'ja', text: '果物の一種' }}
      cells={cellsFor([1, 5, 4, 2, 3], 6, true)}
    />
  ),
};

// 狭幅（320px）：伏字マス・ヒント文が折り返して収まることを確認する。
export const Narrow320: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <DictMirrorView
        levelLabel="L1"
        metaSub="英英 / 英語入力 / すべて"
        word="dictionary"
        wordJa="辞書"
        answerSide="en"
        hint={{ side: 'ja', text: '単語とその意味を並べた本' }}
        cells={cellsFor([1, 4, 4, 5, 3, 4, 8], 13)}
      />
    </div>
  ),
};
