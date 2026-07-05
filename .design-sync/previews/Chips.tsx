import { Chips } from 'typing-language-learning';
const chips = [
  { text: 'I', i: 0 },
  { text: 'like', i: 1 },
  { text: 'this', i: 2 },
  { text: 'book', i: 3 },
];
export const Typing = () => <Chips chips={chips} used={2} curDone={2} curKanaDone={0} hasError={false} />;
