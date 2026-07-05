import { RecordsTable } from 'typing-language-learning';
export const Empty = () => (
  <RecordsTable records={[]} modeKey="both" rankText="英語・日本語" endCondition={{ kind: 'time', value: 60 }} />
);
