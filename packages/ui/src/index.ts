import './styles/stats.css'
import './styles/seg-stats.css'
import './styles/text.css'
import './styles/option-ja.css'
import './styles/quiz-option-label.css'
import './styles/flow.css'
import './styles/passage.css'
import './styles/translate.css'
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
export type { TopFlowProps } from './marathon/TopFlow'

