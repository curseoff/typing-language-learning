import { QuizOptionLabel } from 'typing-language-learning';
const jaOpt = { display: '辞書', variants: ['じしょ'], kana: 'じしょ' };
const enOpt = { display: 'dictionary', variants: ['dictionary'] };
export const JapaneseOption = () => <QuizOptionLabel opt={jaOpt} input="" picked={null} hasError={false} />;
export const JapaneseTyping = () => <QuizOptionLabel opt={jaOpt} input="じ" picked={null} hasError={false} />;
export const EnglishOption = () => <QuizOptionLabel opt={enOpt} input="" picked={null} hasError={false} />;
export const EnglishTyping = () => <QuizOptionLabel opt={enOpt} input="dict" picked={null} hasError={false} />;
