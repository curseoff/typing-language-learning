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
import './styles/cloze.css'
import './styles/keyboard.css'
import './styles/touch.css'
import './styles/romaji.css'
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
import './styles/menu.css'
import './styles/versus.css'
export { Stat, StatsRow } from './shared/Stats.presenter'
export type { StatProps, StatsRowProps } from './shared/Stats.presenter'
export { default as SegStatsTable } from './result/SegStatsTable.presenter'
export type { SegStat, SegChoice, SegStatsTableProps } from './result/SegStatsTable.presenter'
export {
  Chars,
  RubyChars,
  RubyTyped,
  RubyText,
  MaskedRubyText,
  Typed,
  MaskedText,
  Chips,
} from './shared/Text.presenter'
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
} from './shared/Text.presenter'
export { default as OptionJa } from './shared/OptionJa.presenter'
export type { OptionJaProps } from './shared/OptionJa.presenter'
export { default as QuizOptionLabel } from './shared/QuizOptionLabel.presenter'
export type { QuizOpt, QuizOptionLabelProps } from './shared/QuizOptionLabel.presenter'
export { Flow } from './shared/Flow.presenter'
export type { FlowItem, FlowProps } from './shared/Flow.presenter'
export { computeTickerFade, tickerMaskImage } from './shared/tickerMask.util'
export type { TickerBox, TickerFade, TickerFadeOpts } from './shared/tickerMask.util'
export { default as Passage } from './marathon/Passage.presenter'
export type { PassageProps } from './marathon/Passage.presenter'
export { default as TranslateView } from './marathon/TranslateView.presenter'
export type { TranslateViewProps } from './marathon/TranslateView.presenter'
export { default as TopFlow } from './marathon/TopFlow.presenter'
export type { TopFlowProps, TopSeg } from './marathon/TopFlow.presenter'
export { default as Keyboard } from './touch/Keyboard.presenter'
export type { KeyboardProps, KeyboardPressed } from './touch/Keyboard.presenter'
export { default as TouchView } from './touch/TouchView.presenter'
export type { TouchViewProps } from './touch/TouchView.presenter'
export { default as RomajiView } from './romaji/RomajiView.presenter'
export type { RomajiViewProps } from './romaji/RomajiView.presenter'
export { default as KanaTable } from './romaji/KanaTable.presenter'
export type { KanaTableProps } from './romaji/KanaTable.presenter'
export {
  KEY_ROWS,
  KEY_LEGENDS,
  ROW_OFFSET,
  DISPLAY_ONLY_KEYS,
  FINGER,
  FINGER_LABEL,
  HOME_KEYS,
  BUMP_KEYS,
} from './touch/keyboardLayout.util'
export type { Finger, KeyLegend } from './touch/keyboardLayout.util'
export { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow } from './ready/parts.presenter'
export type {
  Mode,
  ModeButtonsProps,
  SectionLabelProps,
  BottomTabsProps,
  StartRowProps,
} from './ready/parts.presenter'
export { default as EndConditionSelect } from './ready/EndConditionSelect.presenter'
export type { EndConditionSelectProps, EndKindOption } from './ready/EndConditionSelect.presenter'
export { default as ItemList } from './ready/ItemList.presenter'
export type { ItemStat, ItemListItem, ItemListProps } from './ready/ItemList.presenter'
export { default as RecordsTable } from './result/RecordsTable.presenter'
export type { RecordRow, EndCond, RecordsTableProps } from './result/RecordsTable.presenter'
export { default as Result } from './result/Result.presenter'
export type { ResultData, ResultProps } from './result/Result.presenter'
export { default as RankSectionView } from './ready/RankSectionView.presenter'
export type { RankLevel, ModeGroup, RankSectionViewProps } from './ready/RankSectionView.presenter'
export { default as StorySectionView } from './ready/StorySectionView.presenter'
export type { StoryOption, StorySectionViewProps } from './ready/StorySectionView.presenter'
export { default as SoundToggle } from './sound/SoundToggle.presenter'
export type { SoundToggleProps } from './sound/SoundToggle.presenter'
export { default as MenuBarView } from './menu/MenuBarView.presenter'
export type { MenuBarViewProps, MenuBarMenu, MenuBarItem } from './menu/MenuBarView.presenter'
export { default as AboutView } from './about/AboutView.presenter'
export type { AboutViewProps } from './about/AboutView.presenter'
export { default as AllRecordsView } from './records/AllRecordsView.presenter'
export type { AllRecordRow, SortKey, SortDir, AllRecordsViewProps } from './records/AllRecordsView.presenter'
export { default as StoryView } from './story/StoryView.presenter'
export type {
  StoryViewProps,
  StoryEndResult,
  StoryActiveInput,
  StoryChoiceView,
  StoryUnitProgress,
} from './story/StoryView.presenter'
export { default as PlayResultView } from './shared/PlayResultView.presenter'
export type {
  PlayResultData,
  PlayRecordRow,
  PlayResultViewProps,
} from './shared/PlayResultView.presenter'
export { WordTypeView, WordQuizView } from './words/WordsView.presenter'
export type {
  WordTypeViewProps,
  WordQuizViewProps,
  WordQuizOption,
} from './words/WordsView.presenter'
export { DictTypeView, DictQuizView, DictPickView } from './dictionary/DictView.presenter'
export type {
  DictTypeViewProps,
  DictQuizViewProps,
  DictPickViewProps,
  DictOption,
  DictWordRuby,
} from './dictionary/DictView.presenter'
export { default as SignalingExchangeView } from './versus/SignalingExchangeView.presenter'
export type {
  VersusRole,
  VersusConnection,
  SignalingExchangeViewProps,
} from './versus/SignalingExchangeView.presenter'
export { default as ProgressCardView } from './versus/ProgressCardView.presenter'
export type { ProgressCardData } from './versus/ProgressCardView.presenter'
export { default as MaskBoard } from './versus/MaskBoard.presenter'
export type { MaskBoardCell, MaskBoardProps } from './versus/MaskBoard.presenter'
export { default as MirrorBoardView } from './versus/MirrorBoardView.presenter'
export type { MirrorBoardData, MirrorHint, MirrorBoardViewProps } from './versus/MirrorBoardView.presenter'
export { default as VersusBoardView } from './versus/VersusBoardView.presenter'
export type { VersusBoardViewProps } from './versus/VersusBoardView.presenter'
export { default as MatchApprovalView } from './versus/MatchApprovalView.presenter'
export type {
  MatchProposal,
  MatchApprovalViewProps,
} from './versus/MatchApprovalView.presenter'

