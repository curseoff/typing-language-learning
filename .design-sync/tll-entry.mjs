// design-sync 用 手書きエントリ。アプリrepoのため main=electron を回避し UI だけを window.TLL に載せる。
// 重いセクション(WordsSection等)は教材データを動的importするため、ビルド時はデータを空スタブに差し替えて 5MB 未満に保つ（NOTES.md 参照）。
import React from 'react';

// --- 既存(TOP軽量) ---
export { default as TouchSection } from '../src/ui/ready/TouchSection.jsx';
export { default as EndConditionSelect } from '../src/ui/ready/EndConditionSelect.jsx';
export { default as ItemList } from '../src/ui/ready/ItemList.jsx';
export { default as QuizOptionLabel } from '../src/ui/shared/QuizOptionLabel.jsx';
export { default as OptionJa } from '../src/ui/shared/OptionJa.jsx';
export { Flow } from '../src/ui/shared/Flow.jsx';
export { Stat, StatsRow } from '../src/ui/shared/Stats.jsx';
export { RubyText, MaskedRubyText } from '../src/ui/shared/Text.jsx';

// --- 追加(軽量・データ非依存) ---
export { default as Keyboard } from '../src/ui/touch/Keyboard.jsx';
export { default as RecordsTable } from '../src/ui/result/RecordsTable.jsx';
export { default as SegStatsTable } from '../src/ui/result/SegStatsTable.jsx';
export { default as SoundToggle } from '../src/ui/sound/SoundToggle.jsx';

// --- 追加(重・教材データ依存＝ビルド時スタブ) ---
export { default as WordsSection } from '../src/ui/ready/WordsSection.jsx';
export { default as DictSection } from '../src/ui/ready/DictSection.jsx';
export { default as WordSentenceSection } from '../src/ui/ready/WordSentenceSection.jsx';
export { default as StorySection } from '../src/ui/ready/StorySection.jsx';
export { default as Ready } from '../src/ui/ready/Ready.jsx';

export { default as Result } from '../src/ui/result/Result.jsx';
export { default as TouchView } from '../src/ui/touch/TouchView.jsx';

export { default as Passage } from '../src/ui/marathon/Passage.jsx';
export { default as TranslateView } from '../src/ui/marathon/TranslateView.jsx';
export { default as MarathonView } from '../src/ui/marathon/MarathonView.jsx';
export { default as StoryView } from '../src/ui/story/StoryView.jsx';
export { Chars, Typed, Chips, RubyTyped, MaskedText } from '../src/ui/shared/Text.jsx';
export { ModeButtons, SectionLabel, BottomTabs, StartRow } from '../src/ui/ready/parts.jsx';
export { default as RecordDetail } from '../src/ui/result/RecordDetail.jsx';

export { WordRecords } from '../src/ui/ready/parts.jsx';
export { RubyChars } from '../src/ui/shared/Text.jsx';
export { default as TopFlow } from '../src/ui/marathon/TopFlow.jsx';

// プレビュー用ヘルパ（コンポーネントではない＝componentSrcMap に入れない）。実 segment を生成する。
export { buildPassage } from '../src/domain/marathon/passage.js';

// プレビュー用ダーク背景ラッパ（provider）。ダークテーマ前提の淡色テキストが白カードで不可視になるのを防ぐ。
export function DSFrame({ children }) {
  return React.createElement(
    'div',
    { style: { background: 'var(--bg)', color: 'var(--text)', padding: '20px', minHeight: '100%' } },
    children,
  );
}
