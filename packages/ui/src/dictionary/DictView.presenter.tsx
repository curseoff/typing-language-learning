// 英英辞典の画面（presenter）：英語/日本語入力（DictTypeView）・単語4択（DictQuizView）・
// 説明文4択（DictPickView）をそれぞれ描くだけ。useDict/useDictQuiz の state・ハンドラと、
// container が算出した HUD 値・和訳・記録ノード（resultNode）を props で受ける。
// フック・content・application には依存しない。
import type { ReactNode } from 'react'
import { StatsRow } from '../shared/Stats.presenter'
import { RubyText } from '../shared/Text.presenter'
import OptionJa from '../shared/OptionJa.presenter'
import QuizOptionLabel from '../shared/QuizOptionLabel.presenter'
import TopFlow, { type TopSeg } from '../marathon/TopFlow.presenter'
import MaskBoard, { type MaskBoardCell } from '../versus/MaskBoard.presenter'

function PlayMeta({ levelLabel, sub }: { levelLabel: string; sub: string }) {
  return (
    <div className="play-meta">
      <span className="meta-badge rank">{levelLabel}</span>
      <span className="meta-badge mode">{sub}</span>
    </div>
  )
}

// 見出し語ヘッダ「単語 <word>（<和訳>）」。solo の入力盤面（DictTypeView）と
// 相手の伏字複製（DictMirrorView）で共有し、両者の見出しを同一マークアップ＝同一見た目にする。
function SegWord({ word, wordJa }: { word?: string; wordJa?: string }) {
  if (!word) return null
  return (
    <p className="seg-word">
      単語 <strong>{word}</strong>
      {wordJa && <span className="seg-word-ja">（{wordJa}）</span>}
    </p>
  )
}

export interface DictOption {
  display: string
  variants: string[]
  kana?: string
  answer?: boolean
  ja?: string
}

export interface DictWordRuby {
  ja?: string
  kana?: string
}

export interface DictTypeViewProps {
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
  word?: string
  wordJa?: string
  hintLead: string
  segments: TopSeg[]
  segIndex: number
  segInput: string
  hasError: boolean
  clozeRevealed?: boolean // #402 現在問題(cloze)でミスがあり正解を開示中か
  compact?: boolean // #439 対戦: 上部 stats を「残り（時間）＋progressバー」だけに絞る（solo は既定 false＝全 stat 維持）
}

// 英語入力（定義文を打つ）/ 日本語入力（和訳を打つ）。TopFlow（ティッカー表示）で描画。
export function DictTypeView({
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
  word,
  wordJa,
  hintLead,
  segments,
  segIndex,
  segInput,
  hasError,
  clozeRevealed = false,
  compact = false,
}: DictTypeViewProps) {
  return (
    <div className="game">
      <PlayMeta levelLabel={levelLabel} sub={metaSub} />
      {finished ? (
        resultNode
      ) : (
        <>
          <StatsRow
            // #439 対戦（compact）は上部を「残り（時間）＋progressバー」だけに絞る（数値はカードに分離）。
            // solo（既定）はタイピング数/速度/ミス/残り の 4 枠を維持する。
            stats={
              compact
                ? [{ label: endStatLabel, value: endStatValue }]
                : [
                    { label: 'タイピング数', value: `${typedKeys}` },
                    { label: '速度', value: `${liveSpeed} 打/分` },
                    { label: 'ミス', value: mistakes },
                    { label: endStatLabel, value: endStatValue },
                  ]
            }
            progress={progress}
          />
          <SegWord word={word} wordJa={wordJa} />
          <TopFlow segments={segments} segIndex={segIndex} segInput={segInput} hasError={hasError} clozeRevealed={clozeRevealed} ticker />
          <p className="hint">
            {hintLead}正しく打つまで次に進めません。
            <kbd>Esc</kbd> で中断。
          </p>
        </>
      )}
    </div>
  )
}

// #439 対戦：相手の入力盤面を伏字で静止複製する（方式B＝構造送信）。solo の DictTypeView と同じ
// .game / .seg-word / .flow マークアップを使い、見出し語＋英語/日本語の2段を「まったく同じ盤面 UI」で描く。
// 答え側（answerSide）の行は伏字マス（MaskBoard・実文字を出さない＝カンニング防止）、ヒント側は実テキスト
// （日本語は RubyText で読み補助）。カーソル・入力欄・stats・ティッカースクロールは持たない（静止複製）。純粋描画。
export interface DictMirrorViewProps {
  levelLabel: string
  metaSub: string
  word?: string // 見出し語（表示可・空なら見出し無し）
  wordJa?: string // 見出し和訳（en モードのみ・ja モードは付かない＝答えになるため）
  answerSide: 'en' | 'ja' // 相手が打っている側＝MaskBoard を出す行
  hint?: { side: 'en' | 'ja'; text: string; kana?: string } // 非答え側の実テキスト（無ければその行を出さない）
  cells: MaskBoardCell[] // 答え行の伏字マス列（domain maskBoardCells の結果）
}

export function DictMirrorView({ levelLabel, metaSub, word, wordJa, answerSide, hint, cells }: DictMirrorViewProps) {
  // 各言語行の中身：答え側は伏字マス、非答え側はヒントの実テキスト（該当が無ければ null＝行を出さない）。
  const rowContent = (side: 'en' | 'ja') => {
    if (side === answerSide) return <MaskBoard cells={cells} />
    if (hint && hint.side === side) {
      return side === 'ja' ? <RubyText ja={hint.text} kana={hint.kana ?? ''} /> : <span>{hint.text}</span>
    }
    return null
  }
  const enNode = rowContent('en')
  const jaNode = rowContent('ja')
  return (
    <div className="game">
      <PlayMeta levelLabel={levelLabel} sub={metaSub} />
      <SegWord word={word} wordJa={wordJa} />
      {/* solo の TopFlow と同じ .flow パネル＋ref-tag 行。ただし ticker は動かさず（静止）内容は全表示（vs-mirror-flow）。 */}
      <div className="flow vs-mirror-flow">
        {enNode && (
          <div className="flow-row">
            <span className="ref-tag en">英語</span>
            <div className="flow-track">{enNode}</div>
          </div>
        )}
        {jaNode && (
          <div className="flow-row">
            <span className="ref-tag ja">日本語</span>
            <div className="flow-track">{jaNode}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export interface DictQuizViewProps {
  levelLabel: string
  metaSub: string
  finished: boolean
  resultNode: ReactNode
  typedKeys: number
  correct: number
  mistakes: number
  endStatLabel: ReactNode
  endStatValue: ReactNode
  progress: number
  prompt: string
  promptJa: string
  pickedJa?: string | null
  options: DictOption[]
  wordRuby?: Record<string, DictWordRuby>
  input: string
  picked: DictOption | null
  hasError: boolean
  onPick: (opt: DictOption) => void
  onAdvance: () => void
}

// 4択（定義→英単語をタイプ/クリック）
export function DictQuizView({
  levelLabel,
  metaSub,
  finished,
  resultNode,
  typedKeys,
  correct,
  mistakes,
  endStatLabel,
  endStatValue,
  progress,
  prompt,
  promptJa,
  pickedJa,
  options,
  wordRuby,
  input,
  picked,
  hasError,
  onPick,
  onAdvance,
}: DictQuizViewProps) {
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
            <div className="word-dir">定義に合う英単語を入力</div>
            <p className="dict-def">{prompt}</p>
            {/* 定義の和訳。内容は回答前から確定するので常に描画し、回答前は不可視で高さだけ確保。 */}
            <p
              className={`dict-ref${picked === null ? ' reveal-pending' : ''}`}
              aria-hidden={picked === null || undefined}
            >
              {promptJa}
            </p>
            <div className={`word-input ${hasError ? 'error' : ''}`}>
              {input ? input : ' '}
              {picked === null && <span className="caret">▍</span>}
            </div>
            {/* 選んだ語の和訳。内容は回答時まで不定なので、常に1行を予約し未確定時は不可視プレースホルダ。 */}
            <p
              className={`word-input-ja${pickedJa ? '' : ' reveal-pending'}`}
              aria-hidden={pickedJa ? undefined : true}
            >
              {pickedJa || ' '}
            </p>
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
              const ruby = wordRuby?.[opt.display] // 英単語→{ja,kana}
              return (
                <button key={i} className={cls} onClick={() => (picked === null ? onPick(opt) : onAdvance())}>
                  {/* ラベルは英単語。opt.kana は定義の読みなので QuizOptionLabel に渡さない（定義をルビ扱いしない）。DictPickView と同様。 */}
                  <QuizOptionLabel opt={{ display: opt.display, variants: opt.variants }} input={input} picked={picked} hasError={hasError} />
                  <OptionJa ja={ruby?.ja} kana={ruby?.kana} revealed={picked !== null} />
                </button>
              )
            })}
          </div>
          <p className="hint">
            {picked === null ? (
              <>定義に合う英単語を入力（クリックでも選択可）。</>
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

export interface DictPickViewProps {
  levelLabel: string
  metaSub: string
  finished: boolean
  resultNode: ReactNode
  typedKeys: number
  correct: number
  mistakes: number
  endStatLabel: ReactNode
  endStatValue: ReactNode
  progress: number
  prompt: string
  headJa?: string
  options: DictOption[]
  input: string
  picked: DictOption | null
  hasError: boolean
  onPick: (opt: DictOption) => void
  onAdvance: () => void
}

// 説明文4択：単語＋意味 → 合う説明文を「打って」選ぶ
export function DictPickView({
  levelLabel,
  metaSub,
  finished,
  resultNode,
  typedKeys,
  correct,
  mistakes,
  endStatLabel,
  endStatValue,
  progress,
  prompt,
  headJa,
  options,
  input,
  picked,
  hasError,
  onPick,
  onAdvance,
}: DictPickViewProps) {
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
            <div className="word-dir">単語に合う説明文を入力</div>
            <p className="dict-head">{prompt}</p>
            {headJa && (
              // 回答前も同じ高さを占めるよう常に描画し、回答前は不可視で伏せる（レイアウトシフト防止）。
              <p
                className={`dict-head-ja${picked === null ? ' reveal-pending' : ''}`}
                aria-hidden={picked === null || undefined}
              >
                {headJa}
              </p>
            )}
            <div className={`word-input ${hasError ? 'error' : ''}`}>
              {input ? input : ' '}
              {picked === null && <span className="caret">▍</span>}
            </div>
            {/* 正解定義の和訳は各選択肢（正解＝緑）の下に出るので、ここでは重複表示しない（#219）。 */}
          </div>
          <div className="pick-options">
            {options.map((opt, i) => {
              let cls = 'quiz-option pick-option'
              if (picked !== null) {
                if (opt.answer) cls += ' correct'
                else if (opt === picked) cls += ' wrong'
                else cls += ' dim'
              } else if (input) {
                cls += opt.variants.some((v) => v.startsWith(input)) ? ' cand' : ' dim'
              }
              return (
                <button key={i} className={cls} onClick={() => (picked === null ? onPick(opt) : onAdvance())}>
                  {/* ラベルは英語の定義。opt.kana は単語の読みなので QuizOptionLabel には渡さない（定義をルビ扱いしない）。 */}
                  <QuizOptionLabel opt={{ display: opt.display, variants: opt.variants }} input={input} picked={picked} hasError={hasError} />
                  <OptionJa ja={opt.ja} kana={opt.kana} revealed={picked !== null} />
                </button>
              )
            })}
          </div>
          <p className="hint">
            {picked === null ? (
              <>単語に合う説明文を入力（クリックでも選択可）。</>
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
