import { EndConditionSelect } from '@tll/ui';
const noop = () => {};
// 新 presenter API：種別チップ(kinds)＋値チップ(values)を props で受けて描くだけ。
const kinds = [
  { kind: 'time', label: '時間' },
  { kind: 'chars', label: '文字数' },
  { kind: 'items', label: '問題数' },
  { kind: 'endless', label: 'エンドレス' },
];
const valueLabel = (kind: string, v: number) =>
  kind === 'time' ? `${v}秒` : kind === 'chars' ? `${v}字` : kind === 'items' ? `${v}問` : `${v}`;
export const TimeMode = () => (
  <EndConditionSelect kinds={kinds} kind="time" value={60} values={[30, 60, 120, 300]}
    valueLabel={valueLabel} focusSection="end" onChange={noop} onChangeValue={noop} onFocusSection={noop} />
);
export const CharsMode = () => (
  <EndConditionSelect kinds={kinds} kind="chars" value={600} values={[300, 600, 1200]}
    valueLabel={valueLabel} focusSection="endKind" onChange={noop} onChangeValue={noop} onFocusSection={noop} />
);
export const Endless = () => (
  <EndConditionSelect kinds={kinds} kind="endless" value={null} values={[]}
    valueLabel={valueLabel} focusSection="endKind" onChange={noop} onChangeValue={noop} onFocusSection={noop} />
);
