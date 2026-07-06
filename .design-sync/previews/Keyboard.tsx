import { Keyboard } from '@tll/ui';
export const Highlight = () => <Keyboard target="f" hasError={false} showTarget={true} />;
export const Blind = () => <Keyboard target="j" hasError={false} showTarget={false} />;
export const Miss = () => <Keyboard target="d" hasError={true} wrongKey="s" pressed={{ key: 's', tick: 1 }} showTarget={true} />;
