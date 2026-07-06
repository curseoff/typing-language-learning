import { Typed } from '@tll/ui';
export const Progress = () => <Typed text="dictionary" done={4} hasError={false} />;
export const Error = () => <Typed text="dictionary" done={4} hasError={true} />;
