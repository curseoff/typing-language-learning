import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressCardView } from '@tll/ui';
import type { MaskBoardCell } from '@tll/ui';

// 対戦中の 1 人ぶんの進捗カード。自分/相手・サドンデス（ライフ）有無を代表 props で描く。
const meta = {
  title: 'versus/ProgressCardView',
  component: ProgressCardView,
} satisfies Meta<typeof ProgressCardView>;
export default meta;
type Story = StoryObj<typeof meta>;

const SELF_ID = '03ecf8d2-1111-4a2b-9c3d-aaaaaaaaaaaa';
const PEER_ID = '77bd90ac-2222-4f5e-8d6c-bbbbbbbbbbbb';

// 自分（強調枠）
export const Self: Story = {
  render: () => (
    <ProgressCardView
      id={SELF_ID}
      self
      typed={128}
      speed={312}
      mistakes={4}
      correct={7}
    />
  ),
};

// 相手（#439 時間枠は撤去＝タイピング数/速度/ミス＋正解問題数のみ）
export const Opponent: Story = {
  render: () => (
    <ProgressCardView
      id={PEER_ID}
      name="ゲスト"
      self={false}
      typed={96}
      speed={240}
      mistakes={9}
      correct={5}
    />
  ),
};

// 終了後（完了バッジ＋順位バッジ）
export const Finished: Story = {
  render: () => (
    <ProgressCardView
      id={SELF_ID}
      self
      typed={128}
      speed={312}
      mistakes={4}
      correct={7}
      finished
      rank={1}
    />
  ),
};

// #439 相手カードに盤面複製（伏字）を差した状態。答え側=英語定義（伏字）、ヒント=日本語。
const MIRROR_CELLS: MaskBoardCell[] = (() => {
  const shape = [2, 4, 4];
  const filled = 3;
  const out: MaskBoardCell[] = [];
  let idx = 0;
  shape.forEach((len, wi) => {
    if (wi > 0) out.push({ kind: 'space', miss: false });
    for (let i = 0; i < len; i += 1) {
      out.push({ kind: idx < filled ? 'filled' : 'pending', miss: false });
      idx += 1;
    }
  });
  return out;
})();

export const OpponentMirror: Story = {
  render: () => (
    <ProgressCardView
      id={PEER_ID}
      name="ゲスト"
      self={false}
      typed={96}
      speed={240}
      mistakes={9}
      correct={5}
      mirror={{
        word: 'apple',
        wordJa: 'りんご',
        answerSide: 'en',
        hint: { side: 'ja', text: '果物の一種' },
        cells: MIRROR_CELLS,
      }}
    />
  ),
};

// サドンデス（残ライフをハートで表示）
export const SuddenDeath: Story = {
  render: () => (
    <ProgressCardView
      id={SELF_ID}
      self
      typed={210}
      speed={360}
      mistakes={2}
      correct={11}
      lives={3}
    />
  ),
};
