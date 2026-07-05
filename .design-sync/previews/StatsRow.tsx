import { StatsRow } from 'typing-language-learning';
const stats = [
  { label: '経過', value: '32秒' },
  { label: '入力', value: '128字' },
  { label: 'ミス', value: '3' },
  { label: '速度', value: '4.2 打/秒' },
];
export const Midway = () => <StatsRow stats={stats} progress={0.55} />;
export const Complete = () => <StatsRow stats={stats} progress={1} />;
