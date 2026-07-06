// 単語問題の画面（presenter）：入力モード（WordTypeView）と4択クイズ（WordQuizView）を
// それぞれ描くだけ。useWords/useWordQuiz の state・ハンドラと、container が算出した HUD 値・
// 記録ノード（resultNode）を props で受ける。フック・content・application には依存しない。
import type { ReactNode } from 'react'
import { StatsRow } from '../shared/Stats'
import { RubyText } from '../shared/Text'
import OptionJa from '../shared/OptionJa'
import QuizOptionLabel from '../shared/QuizOptionLabel'
import TopFlow, { type TopSeg } from '../marathon/TopFlow'

// プレイ画面の上部メタ（レベル／モード・テーマ）。
function PlayMeta({ levelLabel, sub }: { levelLabel: string; sub: string }) {
  return (
    <div className="play-meta">
      <span className="meta-badge rank">{levelLabel}</span>
      <span className="meta-badge mode">{sub}</span>
    </div>
  )
}

export interface WordTypeViewProps {
  levelLabel: string
  metaSub: string
  finished: boolean
  resultNode: ReactNode
  typedKeys: number
  liveSpeed: number
  mistakes: number
  endStatLabel: ReactNode
  endStatValue: ReactNode
  progress: number
  segments: TopSeg[]
  segIndex: number
  segInput: string
  hasError: boolean
}

// 入力モード（英語/日本語/英語・日本語）。文章モードと同じ上部フロー＋下部本文。
export function WordTypeView({
  levelLabel,
  metaSub,
  finished,
  resultNode,
  typedKeys,
  liveSpeed,
  mistakes,
  endStatLabel,
  endStatValue,
  progress,
  segments,
  segIndex,
  segInput,
  hasError,
}: WordTypeViewProps) {
  return (
    <div className="game">
      <PlayMeta levelLabel={levelLabel} sub={metaSub} />
      {finished ? (
        resultNode
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'タイピング数', value: `${typedKeys}` },
              { label: '速度', value: `${liveSpeed} 打/分` },
              { label: 'ミス', value: mistakes },
              { label: endStatLabel, value: endStatValue },
            ]}
            progress={progress}
          />
          <TopFlow segments={segments} segIndex={segIndex} segInput={segInput} hasError={hasError} ticker />
          <p className="hint">
            英単語はそのまま、和文はローマ字で（shi/si など自由）。正しく打つまで次に進めません。
            <kbd>Esc</kbd> で中断してトップへ。
          </p>
        </>
      )}
    </div>
  )
}

export interface WordQuizOption {
  display: string
  variants: string[]
  kana?: string
  answer?: boolean
  en: string
  ja: string
  jaKana?: string
}

export interface WordQuizViewProps {
  levelLabel: string
  metaSub: string
  finished: boolean
  resultNode: ReactNode
  dir: 'en' | 'ja'
  typedKeys: number
  correct: number
  mistakes: number
  endStatLabel: ReactNode
  endStatValue: ReactNode
  progress: number
  prompt: string
  promptKana?: string
  options: WordQuizOption[]
  input: string
  picked: WordQuizOption | null
  hasError: boolean
  onPick: (opt: WordQuizOption) => void
  onAdvance: () => void
}

// 4択クイズ（dir='en':英語訳 / 'ja':日本語訳）
export function WordQuizView({
  levelLabel,
  metaSub,
  finished,
  resultNode,
  dir,
  typedKeys,
  correct,
  mistakes,
  endStatLabel,
  endStatValue,
  progress,
  prompt,
  promptKana,
  options,
  input,
  picked,
  hasError,
  onPick,
  onAdvance,
}: WordQuizViewProps) {
  return (
    <div className="game">
      <PlayMeta levelLabel={levelLabel} sub={metaSub} />
      {finished ? (
        resultNode
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'タイピング数', value: `${typedKeys}` },
              { label: '正解', value: correct },
              { label: 'ミス', value: mistakes },
              { label: endStatLabel, value: endStatValue },
            ]}
            progress={progress}
          />
          <div className="word-card">
            <div className="word-dir">
              {dir === 'ja' ? '英単語に合う和訳をローマ字で入力' : '意味に合う英単語を入力'}
            </div>
            <p className="word-prompt">
              {promptKana ? <RubyText ja={prompt} kana={promptKana} /> : prompt}
            </p>
            <div className={`word-input ${hasError ? 'error' : ''}`}>
              {input ? input : ' '}
              {picked === null && <span className="caret">▍</span>}
            </div>
          </div>
          <div className="quiz-options">
            {options.map((opt, i) => {
              let cls = 'quiz-option'
              if (picked !== null) {
                if (opt.answer) cls += ' correct'
                else if (opt === picked) cls += ' wrong'
                else cls += ' dim'
              } else if (input) {
                cls += opt.variants.some((v) => v.startsWith(input)) ? ' cand' : ' dim'
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => (picked === null ? onPick(opt) : onAdvance())}
                >
                  <QuizOptionLabel opt={opt} input={input} picked={picked} hasError={hasError} />
                  {/* 回答後に反対側を表示（#221）。英語訳→和訳＋ルビ／日本語訳→英語(プレーン)。 */}
                  {dir === 'ja' ? (
                    <OptionJa ja={opt.en} kana={undefined} revealed={picked !== null} />
                  ) : (
                    <OptionJa ja={opt.ja} kana={opt.jaKana} revealed={picked !== null} />
                  )}
                </button>
              )
            })}
          </div>
          <p className="hint">
            {picked === null ? (
              <>{dir === 'ja' ? '和訳をローマ字で入力' : '英単語を入力'}（クリックでも選択可）。</>
            ) : (
              <>
                <kbd>Enter</kbd> / <kbd>Space</kbd> で次へ。
              </>
            )}
            <kbd>Esc</kbd> で中断。
          </p>
        </>
      )}
    </div>
  )
}
