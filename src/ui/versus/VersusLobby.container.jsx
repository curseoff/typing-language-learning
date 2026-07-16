// #432 P2P 穴埋め対戦：対戦ロビー（container）。
// 既存トップ設定UI（種類/レベル/テーマ/範囲/モード/終了条件）と同じ見た目で対戦条件を選び、
// makeMatchConfig に束ねて props.onPropose(config) へ渡す。ここでは接続や useVersus は結線しない
// （onPropose はコールバックで受け取る＝PR6 のスコープ）。学習モードは cloze 固定・4択/翻訳/エンドレスは出さない。
//
// 流用方針：ready の section container（DictSection/WordSentenceSection/WordsSection）は records/収録一覧/
// 下部タブ/App の巨大 state に密結合で、そのままでは対戦ロビーに不要な UI を引き込む。よって parts.container の
// 共有プリミティブ（selCls/ModeButtons/SectionLabel/RangeStepper/THEME_OPTIONS）と @tll/ui の EndConditionSelect
// presenter を流用して最小の設定UIを組む（CSS クラス＝トークンは既存に完全一致させる）。
import { useMemo, useState } from 'react'
import { EndConditionSelect as EndConditionSelectView } from '@tll/ui'
import {
  selCls,
  ModeButtons,
  SectionLabel,
  RangeStepper,
  THEME_OPTIONS,
  dictLevelLabel,
} from '../ready/parts.container.jsx'
import { WORD_LEVELS, WORD_COUNTS } from '../../content/words.js'
import { DICT_AVAILABLE_LEVELS, DICT_COUNTS } from '../../content/dictionary.js'
import { WSENT_COUNTS } from '../../content/wordSentences/index.js'
import { MODES } from '../../content/modes.js'
import { END_KINDS, endKind, endValueLabel, endConditionForKind } from '../../content/endConditions.js'
import { learningLabel, learningDesc } from '../../content/learningModes.js'
import { makeEndCondition } from '../../domain/session/endCondition.vo.js'
import { makeMatchConfig } from '../../domain/versus/matchConfig.vo.js'

// 種類は単語/単語例文/英英の3つのみ（物語・タッチ・ローマ字は対戦対象外）。
const GAME_TYPES = [
  { key: 'words', icon: '🔤', label: '単語', sub: '語彙を覚える' },
  { key: 'wsent', icon: '✍️', label: '単語例文', sub: '単語を文で使う' },
  { key: 'dict', icon: '📚', label: '英英辞典', sub: '英語で意味を学ぶ' },
]

// モードは通常入力（both/en/ja）のみ（4択 quiz/pick・翻訳 -tr は対戦では出さない）。
const VS_MODES = MODES.filter((m) => m.key === 'both' || m.key === 'en' || m.key === 'ja')

// 終了条件はエンドレス以外の4種（時間/文字数/問題数/サドンデス）。対戦は必ず終わる条件で行う。
const VS_END_KINDS = END_KINDS.filter((k) => k.kind !== 'endless')

// 種類ごとのレベル選択肢・収録数・範囲の単位を解決する（単語/例文は WORD_LEVELS、英英は DICT_AVAILABLE_LEVELS）。
const WORD_LEVEL_OPTIONS = WORD_LEVELS.map((l) => ({ value: l.level, no: `L${l.level}`, label: l.label }))
const DICT_LEVEL_OPTIONS = DICT_AVAILABLE_LEVELS.map((lv) => ({ value: lv, no: `L${lv}`, label: dictLevelLabel(lv) }))

function typeConfig(gameType) {
  if (gameType === 'dict') return { levels: DICT_LEVEL_OPTIONS, counts: DICT_COUNTS, unit: '語' }
  if (gameType === 'wsent') return { levels: WORD_LEVEL_OPTIONS, counts: WSENT_COUNTS, unit: '文' }
  return { levels: WORD_LEVEL_OPTIONS, counts: WORD_COUNTS, unit: '語' } // words
}

export default function VersusLobby({ onPropose, onEndSession }) {
  const [gameType, setGameType] = useState('dict')
  const [level, setLevel] = useState(1)
  const [theme, setTheme] = useState(THEME_OPTIONS[0]) // 'すべて'
  const [range, setRange] = useState(null) // null=範囲指定なし（全体）/ 1..count
  const [mode, setMode] = useState('en')
  const [endKindKey, setEndKindKey] = useState('time')
  const [endValue, setEndValue] = useState(60)
  const [focusSection, setFocusSection] = useState('type')

  const cfg = useMemo(() => typeConfig(gameType), [gameType])
  const total = cfg.counts[level]?.[theme] ?? 0
  const endValues = endKind(endKindKey).values ?? []

  // 種類を切り替える。新しい種類で選べないレベルなら先頭レベルへ寄せ、範囲は毎回リセットする
  // （収録数が種類/レベル/テーマで変わるため、古い range を持ち越すと不整合になる）。
  const onTypeChange = (key) => {
    setGameType(key)
    const { levels } = typeConfig(key)
    if (!levels.some((l) => l.value === level)) setLevel(levels[0]?.value ?? 1)
    setRange(null)
    setFocusSection('type')
  }

  const onLevelChange = (v) => {
    setLevel(v)
    setRange(null) // レベルで収録数が変わるので範囲はリセット
    setFocusSection('level')
  }

  const onThemeChange = (t) => {
    setTheme(t)
    setRange(null) // テーマで収録数が変わるので範囲はリセット
    setFocusSection('theme')
  }

  // 終了条件の種別を切替えたら、その種別の既定値へ整える（EndConditionSelect container と同じ作法）。
  const onEndKindChange = (k) => {
    const ec = endConditionForKind(k)
    setEndKindKey(ec.kind)
    setEndValue(ec.value)
    setFocusSection('endKind')
  }

  // 「対戦開始」：選んだ設定を MatchConfig に束ねて onPropose へ渡す。UI 側で妥当な集合に限定してあるため
  // makeMatchConfig は throw しない（gameType/mode/endless 除外・cloze 固定・theme 非空・level 正整数）。
  const onStart = () => {
    const config = makeMatchConfig({
      gameType,
      level,
      theme,
      range,
      mode,
      endCondition: makeEndCondition(endKindKey, endValue),
      learningMode: 'cloze',
    })
    onPropose?.(config)
  }

  return (
    <div className="ready vs-lobby">
      <p className="lead">対戦の条件を選んで、相手に提案します。学習モードは穴埋め固定です。</p>

      {/* 種類タブ（単語/単語例文/英英） */}
      <div className="type-tabs">
        {GAME_TYPES.map((t) => (
          <button
            key={t.key}
            className={`type-tab ${selCls(gameType === t.key, focusSection === 'type')}`}
            onClick={() => onTypeChange(t.key)}
          >
            <span className="type-icon">{t.icon}</span>
            <span className="type-label">{t.label}</span>
            <span className="type-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* レベル */}
      <SectionLabel>レベル</SectionLabel>
      <div className="rank-select">
        <div className="rank-group">
          <div className="rank-btns">
            {cfg.levels.map((l) => (
              <button
                key={l.value}
                className={`rank-btn ${selCls(level === l.value, focusSection === 'level')}`}
                onClick={() => onLevelChange(l.value)}
              >
                <span className="rank-no">{l.no}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* テーマ */}
      <SectionLabel>テーマ</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <div className="mode-btns">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t}
                className={`mode-btn ${selCls(theme === t, focusSection === 'theme')}`}
                onClick={() => onThemeChange(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 範囲（毎回同じ順で復習） */}
      <RangeStepper total={total} range={range} onChange={setRange} unit={cfg.unit} />

      {/* モード（通常入力のみ） */}
      <SectionLabel>モード</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <ModeButtons
            modes={VS_MODES}
            value={mode}
            focused={focusSection === 'mode'}
            onChange={(k) => {
              setMode(k)
              setFocusSection('mode')
            }}
          />
        </div>
      </div>
      <p className="pool-count">この条件の収録: {total} {cfg.unit}</p>

      {/* 学習モード（穴埋め固定＝対戦は cloze のみ） */}
      <SectionLabel>学習モード</SectionLabel>
      <p className="mode-desc">
        {learningLabel('cloze')}（固定）：{learningDesc('cloze')}
      </p>

      {/* 終了条件（エンドレス以外の4種） */}
      <EndConditionSelectView
        kinds={VS_END_KINDS}
        kind={endKindKey}
        value={endValue}
        values={endValues}
        valueLabel={endValueLabel}
        focusSection={focusSection}
        onChange={onEndKindChange}
        onChangeValue={(v) => {
          setEndValue(v)
          setFocusSection('end')
        }}
        onFocusSection={setFocusSection}
      />

      <div className="vs-lobby-actions">
        <button type="button" className="vs-btn vs-btn-primary" onClick={onStart}>
          対戦開始
        </button>
        {/* 対戦終了：接続を閉じて接続画面（部屋を作る/入る）へ戻る（ローカル操作・#432 ナビ改善）。 */}
        <button type="button" className="vs-btn vs-btn-secondary" onClick={() => onEndSession?.()}>
          対戦終了
        </button>
      </div>
    </div>
  )
}
