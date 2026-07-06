import { DictTypeView } from '@tll/ui';
// 英英辞典の入力モード presenter（プレイ中）。定義文をティッカーで打つ。
const segments = [
  { type: 'en', en: 'a book that lists words and their meanings', ja: '', kana: '', sentenceIndex: 0 },
];
export const Typing = () => (
  <DictTypeView levelLabel="英英 L1" metaSub="英語入力 / すべて" finished={false} resultNode={null}
    typedKeys={96} liveSpeed={230} mistakes={3} endStatLabel="残り" endStatValue="30秒" progress={0.55}
    word="dictionary" wordJa="辞書" hintLead="この語を英語で説明した文を打ちます。"
    segments={segments} segIndex={0} segInput="a book that l" hasError={false} />
);
