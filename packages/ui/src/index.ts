import './styles/stats.css'
import './styles/seg-stats.css'
import './styles/text.css'
import './styles/option-ja.css'
import './styles/quiz-option-label.css'
import './styles/quiz.css'
import './styles/dict.css'
import './styles/flow.css'
import './styles/passage.css'
import './styles/translate.css'
import './styles/keyboard.css'
import './styles/touch.css'
import './styles/parts.css'
import './styles/browse.css'
import './styles/records.css'
import './styles/result.css'
import './styles/section.css'
import './styles/story-section.css'
import './styles/story.css'
import './styles/about.css'
import './styles/all-records.css'
import './styles/sound.css'
export { Stat, StatsRow } from './shared/Stats'
export type { StatProps, StatsRowProps } from './shared/Stats'
export { default as SegStatsTable } from './result/SegStatsTable'
export type { SegStat, SegChoice, SegStatsTableProps } from './result/SegStatsTable'
export {
  Chars,
  RubyChars,
  RubyTyped,
  RubyText,
  MaskedRubyText,
  Typed,
  MaskedText,
  Chips,
} from './shared/Text'
export type {
  CharsProps,
  RubyCharsProps,
  RubyTypedProps,
  RubyTextProps,
  MaskedRubyTextProps,
  TypedProps,
  MaskedTextProps,
  Chip,
  ChipsProps,
} from './shared/Text'
export { default as OptionJa } from './shared/OptionJa'
export type { OptionJaProps } from './shared/OptionJa'
export { default as QuizOptionLabel } from './shared/QuizOptionLabel'
export type { QuizOpt, QuizOptionLabelProps } from './shared/QuizOptionLabel'
export { Flow } from './shared/Flow'
export type { FlowItem, FlowProps } from './shared/Flow'
export { computeTickerFade, tickerMaskImage } from './shared/tickerMask'
export type { TickerBox, TickerFade, TickerFadeOpts } from './shared/tickerMask'
export { default as Passage } from './marathon/Passage'
export type { PassageProps } from './marathon/Passage'
export { default as TranslateView } from './marathon/TranslateView'
export type { TranslateViewProps } from './marathon/TranslateView'
export { default as TopFlow } from './marathon/TopFlow'
export type { TopFlowProps, TopSeg } from './marathon/TopFlow'
export { default as Keyboard } from './touch/Keyboard'
export type { KeyboardProps, KeyboardPressed } from './touch/Keyboard'
export { default as TouchView } from './touch/TouchView'
export type { TouchViewProps } from './touch/TouchView'
export {
  KEY_ROWS,
  KEY_LEGENDS,
  ROW_OFFSET,
  DISPLAY_ONLY_KEYS,
  FINGER,
  FINGER_LABEL,
  HOME_KEYS,
  BUMP_KEYS,
} from './touch/keyboardLayout'
export type { Finger, KeyLegend } from './touch/keyboardLayout'
export { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow } from './ready/parts'
export type {
  Mode,
  ModeButtonsProps,
  SectionLabelProps,
  BottomTabsProps,
  StartRowProps,
} from './ready/parts'
export { default as EndConditionSelect } from './ready/EndConditionSelect'
export type { EndConditionSelectProps, EndKindOption } from './ready/EndConditionSelect'
export { default as ItemList } from './ready/ItemList'
export type { ItemStat, ItemListItem, ItemListProps } from './ready/ItemList'
export { default as RecordsTable } from './result/RecordsTable'
export type { RecordRow, EndCond, RecordsTableProps } from './result/RecordsTable'
export { default as Result } from './result/Result'
export type { ResultData, ResultProps } from './result/Result'
export { default as RankSectionView } from './ready/RankSectionView'
export type { RankLevel, ModeGroup, RankSectionViewProps } from './ready/RankSectionView'
export { default as StorySectionView } from './ready/StorySectionView'
export type { StoryOption, StorySectionViewProps } from './ready/StorySectionView'
export { default as SoundToggle } from './sound/SoundToggle'
export type { SoundToggleProps } from './sound/SoundToggle'
export { default as AboutView } from './about/AboutView'
export type { AboutViewProps } from './about/AboutView'
export { default as AllRecordsView } from './records/AllRecordsView'
export type { AllRecordRow, SortKey, SortDir, AllRecordsViewProps } from './records/AllRecordsView'
export { default as StoryView } from './story/StoryView'
export type {
  StoryViewProps,
  StoryEndResult,
  StoryActiveInput,
  StoryChoiceView,
  StoryUnitProgress,
} from './story/StoryView'
export { default as PlayResultView } from './shared/PlayResultView'
export type {
  PlayResultData,
  PlayRecordRow,
  PlayResultViewProps,
} from './shared/PlayResultView'
export { WordTypeView, WordQuizView } from './words/WordsView'
export type {
  WordTypeViewProps,
  WordQuizViewProps,
  WordQuizOption,
} from './words/WordsView'
export { DictTypeView, DictQuizView, DictPickView } from './dictionary/DictView'
export type {
  DictTypeViewProps,
  DictQuizViewProps,
  DictPickViewProps,
  DictOption,
  DictWordRuby,
} from './dictionary/DictView'

