import { MaskedText } from 'typing-language-learning';
export const Masked = () => <MaskedText text="dictionary" pos={4} hasError={false} />;
export const Error = () => <MaskedText text="dictionary" pos={4} hasError={true} />;
