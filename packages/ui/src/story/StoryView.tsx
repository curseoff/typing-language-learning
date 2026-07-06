// 物語モードの画面（presenter）：useStory の state と、container が domain で算出した進捗・
// 選択肢ビュー・翻訳入力ビューを props で受け、本文/フロー/選択肢/エンディングを描くだけ。
// フック・content・application・domain には依存しない（記録詳細モーダルは recordsNode で受ける）。
import type { ReactNode } from 'react'
import { StatsRow } from '../shared/Stats'
import { Flow, type FlowItem } from '../shared/Flow'
import { Chars, Chips, MaskedText, type Chip } from '../shared/Text'
import SegStatsTable, { type SegStat } from '../result/SegStatsTable'

export interface StoryEndResult {
  speed: number
  keys: number
  seconds: number
  mistakes: number
  accuracy: number
}

// 翻訳モードの原文＋伏せ字入力欄（container が guideText/consumedWords で算出して渡す）。
export interface StoryActiveInput {
  source: string
  chips?: Chip[]
  used: number
  target: string
  pos: number
}

// 分岐選択肢の1つ（container が segMatches/kanjiDone で算出して渡す）。
export interface StoryChoiceView {
  key: string
  lang: 'en' | 'ja'
  en: string
  ja: string
  matched: boolean
  enDone: number
  enCursor: number
  jaDone: number
  hasError: boolean
}

export interface StoryUnitProgress {
  current: number
  total: number
  typeLabel: string
}

export interface StoryViewProps {
  storyTitle: string
  modeLabel: string
  foundCount: number
  endingCount: number
  stage: string
  hasError: boolean
  onRestart: () => void
  onExit: () => void
  // エンディング
  endLabel?: string
  endEn?: string
  endJa?: string
  result?: StoryEndResult | null
  segStats?: SegStat[]
  recordsNode?: ReactNode
  // プレイ中
  typedKeys: number
  liveSpeed: number
  mistakes: number
  elapsedSec: number
  barProgress: number
  showFlow: boolean
  flowItems: FlowItem[]
  enDone: number
  jaDone: number
  jaKanaDone: number
  activeRow: 'en' | 'ja' | null
  isBoth: boolean
  unitProgress: StoryUnitProgress | null
  activeInput: StoryActiveInput | null
  choices: StoryChoiceView[] | null
}

export default function StoryView({
  storyTitle,
  modeLabel,
  foundCount,
  endingCount,
  stage,
  hasError,
  onRestart,
  onExit,
  endLabel,
  endEn,
  endJa,
  result,
  segStats,
  recordsNode,
  typedKeys,
  liveSpeed,
  mistakes,
  elapsedSec,
  barProgress,
  showFlow,
  flowItems,
  enDone,
  jaDone,
  jaKanaDone,
  activeRow,
  isBoth,
  unitProgress,
  activeInput,
  choices,
}: StoryViewProps) {
  return (
    <div className="story">
      <div className="play-meta">
        <span className="meta-badge rank">{storyTitle}</span>
        <span className="meta-badge mode">{modeLabel}</span>
      </div>
      <div className="story-found-line">
        発見エンド {foundCount} / {endingCount}
      </div>

      {stage === 'ending' ? (
        <div className="story-ending">
          <div className="ending-badge">{endLabel}</div>
          <p className="ending-text">{endEn}</p>
          <p className="ending-ja">{endJa}</p>
          {result && (
            <div className="result-sub">
              <span>{result.speed} 打/分</span>
              <span>{result.keys} 打</span>
              <span>{result.seconds} 秒</span>
              <span>ミス {result.mistakes}</span>
              <span>正確率 {result.accuracy}%</span>
            </div>
          )}
          <div className="ending-actions">
            <button className="btn-primary" onClick={onRestart}>
              最初から
            </button>
            <button className="story-exit" onClick={onExit}>
              トップへ
            </button>
          </div>
          <p className="key-hint">
            <kbd>Enter</kbd> 最初から / <kbd>Esc</kbd> トップ
          </p>
          <SegStatsTable segStats={segStats} />
          {recordsNode}
        </div>
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'タイピング数', value: typedKeys },
              { label: '速度', value: `${liveSpeed} 打/分` },
              { label: 'ミス', value: mistakes },
              { label: '時間', value: `${elapsedSec} 秒` },
            ]}
            progress={barProgress}
          />

          {showFlow && (
            <Flow
              items={flowItems}
              cur={0}
              enDone={enDone}
              jaDone={jaDone}
              jaKanaDone={jaKanaDone}
              hasError={hasError}
              activeRow={activeRow}
              showEn
              showJa
              // 問題入力中はカード型(ticker)、選択肢表示中は以前の段組み(wrap)に切替
              ticker={stage === 'text'}
              wrap={stage === 'choice'}
              isBoth={isBoth}
            />
          )}

          {unitProgress && (
            <div className="story-progress">
              {unitProgress.current} / {unitProgress.total}（{unitProgress.typeLabel}）
            </div>
          )}

          {/* 翻訳モードは Flow が出ないので入力欄が必要。非翻訳（en/ja/both）は Flow が
              入力進捗を兼ねるため、重複するモノスペース入力欄は出さない。 */}
          {activeInput && (
            <>
              <p className="story-prompt">{activeInput.source}</p>
              {activeInput.chips && <Chips chips={activeInput.chips} used={activeInput.used} />}
              <div className="story-en masked">
                <MaskedText text={activeInput.target} pos={activeInput.pos} hasError={hasError} />
              </div>
            </>
          )}

          {choices && (
            <div className="story-choices">
              {choices.map((c, i) => (
                <div key={i} className={`story-choice ${c.matched ? '' : 'dim'}`}>
                  <span className="choice-key">{c.key}</span>
                  <div className="choice-body">
                    <div className="choice-en">
                      {c.lang === 'en' ? (
                        <Chars text={c.en} done={c.enDone} cursor={c.enCursor} hasError={c.hasError} />
                      ) : (
                        c.en
                      )}
                    </div>
                    <div className="choice-ja">
                      {c.lang === 'ja' ? (
                        <Chars text={c.ja} done={c.jaDone} cursor={c.jaDone} hasError={c.hasError} />
                      ) : (
                        c.ja
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="hint">
            {stage === 'text'
              ? '表示された文を入力。'
              : '選択肢のどれか1つを最後まで入力すると進みます。'}
            <kbd>Esc</kbd> でトップへ。
          </p>
        </>
      )}
    </div>
  )
}
