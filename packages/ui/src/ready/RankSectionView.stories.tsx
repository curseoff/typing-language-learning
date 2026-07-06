import type { Meta, StoryObj } from '@storybook/react-vite';
import { RankSectionView, EndConditionSelect, ItemList, RecordsTable } from '@tll/ui';

// 単語／英英／単語例文タブ共通の準備画面 presenter。選択肢・選択値・描画済みノードを props で受ける。
const meta = {
  title: 'ready/RankSectionView',
  component: RankSectionView,
} satisfies Meta<typeof RankSectionView>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const levels = [
  { value: 1, no: 'L1', label: 'やさしい' },
  { value: 2, no: 'L2', label: 'ふつう' },
  { value: 3, no: 'L3', label: 'むずかしい' },
];
const themes = ['すべて', '日常', '旅行', 'ビジネス'];
const modeGroups = [
  { course: '通常入力', modes: [{ key: 'both', label: '英語・日本語' }, { key: 'en', label: '英語' }, { key: 'ja', label: '日本語' }] },
  { course: '4択', modes: [{ key: 'quiz-ja', label: '日本語' }, { key: 'quiz-en', label: '英語' }] },
];
const kinds = [{ kind: 'time', label: '時間' }, { kind: 'chars', label: '文字数' }, { kind: 'items', label: '問題数' }];
const valueLabel = (k: string, v: number) => (k === 'time' ? `${v}秒` : k === 'chars' ? `${v}字` : `${v}問`);
const endNode = (
  <EndConditionSelect
    kinds={kinds}
    kind="time"
    value={60}
    values={[30, 60, 120]}
    valueLabel={valueLabel}
    focusSection=""
    onChange={noop}
    onChangeValue={noop}
    onFocusSection={noop}
  />
);
const words = [
  { en: 'dictionary', ja: '辞書', freq: 1200 },
  { en: 'picture', ja: '写真', freq: 800 },
  { en: 'travel', ja: '旅行', freq: 500 },
];
const recs = [
  { keys: 240, speed: 240, correctCount: 23, accuracy: 98, seconds: 60, date: '2026-07-05 21:00' },
  { keys: 210, speed: 210, correctCount: 20, accuracy: 95, seconds: 60, date: '2026-07-04 10:00' },
];
const shared = {
  levels,
  themes,
  modeGroups,
  level: 1,
  theme: 'すべて',
  mode: 'both',
  onLevelChange: noop,
  onThemeChange: noop,
  onModeChange: noop,
  onFocusSection: noop,
  modeDesc: '英語と日本語を交互に入力します。',
  poolCount: '収録 320 語',
  onStart: noop,
  onBottomTabChange: noop,
  endConditionNode: endNode,
};

export const WordsList: Story = {
  render: () => (
    <RankSectionView
      {...shared}
      focusSection="mode"
      bottomTab="list"
      browseNode={<ItemList items={words} type="words" mode="both" />}
    />
  ),
};
export const WordsRecords: Story = {
  render: () => (
    <RankSectionView
      {...shared}
      focusSection="level"
      bottomTab="records"
      browseNode={
        <RecordsTable records={recs} modeKey="both" rankText="単語 L1 / すべて" endCondition={{ kind: 'time', value: 60 }} />
      }
    />
  ),
};
