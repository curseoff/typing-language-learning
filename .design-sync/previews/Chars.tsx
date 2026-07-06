import { Chars } from '@tll/ui';
export const Typing = () => <Chars text="dictionary" done={4} cursor={4} hasError={false} />;
export const Error = () => <Chars text="dictionary" done={4} cursor={4} hasError={true} />;
export const Done = () => <Chars text="travel" done={6} cursor={-1} hasError={false} />;
