import type { Meta, StoryObj } from '@storybook/react-vite';
import { StorySectionView, RecordsTable } from '@tll/ui';

// 物語タブの準備画面 presenter。物語カード＋モード＋説明＋下部タブ＋一覧/記録ノードを props で受ける。
const meta = {
  title: 'ready/StorySectionView',
  component: StorySectionView,
} satisfies Meta<typeof StorySectionView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const stories = [
  { id: 'travel', title: '旅の物語', sceneCount: 12, endingCount: 5 },
  { id: 'mystery', title: '館の謎', sceneCount: 9, endingCount: 4 },
];
const modeGroups = [
  { course: '通常入力', modes: [{ key: 'both', label: '英語・日本語' }, { key: 'en', label: '英語' }, { key: 'ja', label: '日本語' }] },
];
const recs = [{ keys: 480, speed: 210, correctCount: 30, accuracy: 97, seconds: 92, date: '2026-07-05 21:00' }];
const shared = {
  stories,
  modeGroups,
  storyId: 'travel',
  mode: 'both',
  onStoryIdChange: noop,
  onModeChange: noop,
  onFocusSection: noop,
  onStart: noop,
  onBottomTabChange: noop,
  modeDesc: '物語を読み進めながら英語と日本語を入力します。',
  poolCount: '12 場面 / 5 エンド',
};

export const List: Story = {
  render: () => (
    <StorySectionView
      {...shared}
      focusSection="story"
      bottomTab="list"
      browseNode={
        <ol className="browse-list">
          <li className="browse-item">
            <span className="bi-en">Scene 1</span>
            <span className="bi-ja">駅に着く</span>
          </li>
        </ol>
      }
    />
  ),
};
export const Records: Story = {
  render: () => (
    <StorySectionView
      {...shared}
      focusSection="mode"
      bottomTab="records"
      browseNode={
        <RecordsTable records={recs} modeKey="both" rankText="旅の物語" endCondition={{ kind: 'endless', value: null }} />
      }
    />
  ),
};
