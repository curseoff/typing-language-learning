import { RubyChars } from 'typing-language-learning';
export const Typing = () => <RubyChars ja="辞書" kana="じしょ" done={0} cursor={0} kanaDone={2} hasError={false} />;
export const Done = () => <RubyChars ja="旅行" kana="りょこう" done={2} cursor={-1} kanaDone={4} hasError={false} />;
export const Error = () => <RubyChars ja="写真" kana="しゃしん" done={0} cursor={0} kanaDone={1} hasError={true} />;
