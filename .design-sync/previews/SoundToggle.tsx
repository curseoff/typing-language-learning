import { SoundToggle } from 'typing-language-learning';
// position:fixed の固定ボタン。単体で見えるよう相対配置の器に入れる。
export const Toggle = () => (
  <div style={{ position: 'relative', height: 64 }}>
    <SoundToggle />
  </div>
);
