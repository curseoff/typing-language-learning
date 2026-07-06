import { SoundToggle } from '@tll/ui';
const noop = () => {};
// position:fixed の固定ボタン。単体で見えるよう相対配置の器に入れる。muted/onToggle を props で受ける。
export const On = () => (
  <div style={{ position: 'relative', height: 64 }}>
    <SoundToggle muted={false} onToggle={noop} />
  </div>
);
export const Muted = () => (
  <div style={{ position: 'relative', height: 64 }}>
    <SoundToggle muted={true} onToggle={noop} />
  </div>
);
