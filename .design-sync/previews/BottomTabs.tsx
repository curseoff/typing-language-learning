import { BottomTabs } from 'typing-language-learning';
const noop = () => {};
export const Records = () => <BottomTabs value="records" onChange={noop} focused={true} />;
export const List = () => <BottomTabs value="list" onChange={noop} focused={false} />;
