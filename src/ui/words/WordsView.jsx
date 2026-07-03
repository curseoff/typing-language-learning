// 単語問題の画面。入力モード（英語/日本語/英語・日本語）と4択クイズを振り分ける。
import { useWords } from '../../application/useWords.js'
import { useWordQuiz } from '../../application/useWordQuiz.js'
import { wordRecKey } from '../../application/records.js'
import { StatsRow, QuizOptionLabel, RubyText } from '../shared/index.js'
import { endHudStat } from '../../content/endConditions.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'
import SegStatsTable from '../result/SegStatsTable.jsx'
import TopFlow from '../marathon/TopFlow.jsx'

export default function WordsView({ words, level, theme, mode, seed, levelLabel, modeLabel, endCondition, onExit }) {
  const meta = (
    <div className="play-meta">
      <span className="meta-badge rank">{levelLabel}</span>
      <span className="meta-badge mode">{modeLabel} / {theme}</span>
    </div>
  )
  return mode.startsWith('quiz') ? (
    <QuizView
      words={words}
      level={level}
      theme={theme}
      mode={mode}
      dir={mode === 'quiz-ja' ? 'ja' : 'en'}
      seed={seed}
      meta={meta}
      endCondition={endCondition}
      onExit={onExit}
    />
  ) : (
    <TypeView words={words} level={level} theme={theme} mode={mode} seed={seed} meta={meta} endCondition={endCondition} onExit={onExit} />
  )
}

// 入力モード（英語/日本語/英語・日本語）。文章モードと同じ上部フロー＋下部本文。
function TypeView({ words, level, theme, mode, seed, meta, endCondition, onExit }) {
  const w = useWords({ allWords: words, level, theme, mode, seed, endCondition, onExit })
  // items 制の HUD 進捗＝完了語数（segIndex）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: w.elapsedSec, keys: w.typedKeys, items: w.segIndex })
  // 時間制はフックの滑らかな progress を維持し、文字数制/問題数制は endStat 側（打鍵/問題基準）へ切替える。
  const progress = (endCondition?.kind ?? 'time') === 'time' ? w.progress : endStat.progress

  return (
    <div className="game">
      {meta}
      {w.finished ? (
        <WordResult
          result={w.result}
          records={w.records}
          level={level}
          theme={theme}
          mode={mode}
          onRetry={w.restart}
          onExit={onExit}
        />
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'タイピング数', value: `${w.typedKeys}` },
              { label: '速度', value: `${w.liveSpeed} 打/分` },
              { label: 'ミス', value: w.mistakes },
              { label: endStat.label, value: endStat.value },
            ]}
            progress={progress}
          />
          <TopFlow
            segments={w.segments}
            segIndex={w.segIndex}
            segInput={w.segInput}
            hasError={w.hasError}
            ticker
          />
          <p className="hint">
            英単語はそのまま、和文はローマ字で（shi/si など自由）。正しく打つまで次に進めません。
            <kbd>Esc</kbd> で中断してトップへ。
          </p>
        </>
      )}
    </div>
  )
}

// 4択クイズ（dir='en':英語訳 / 'ja':日本語訳）
function QuizView({ words, level, theme, mode, dir, seed, meta, endCondition, onExit }) {
  const q = useWordQuiz({ words, level, theme, dir, mode, seed, endCondition, onExit })
  // items 制の HUD 進捗＝完答した設問数（index）。time/chars は不変。
  const endStat = endHudStat(endCondition, { elapsedSec: q.elapsedSec, keys: q.typedKeys, items: q.index })

  return (
    <div className="game">
      {meta}
      {q.finished ? (
        <WordResult
          result={q.result}
          records={q.records}
          level={level}
          theme={theme}
          mode={mode}
          onRetry={q.restart}
          onExit={onExit}
        />
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'タイピング数', value: `${q.typedKeys}` },
              { label: '正解', value: q.correct },
              { label: 'ミス', value: q.mistakes },
              { label: endStat.label, value: endStat.value },
            ]}
            progress={endStat.progress}
          />
          <div className="word-card">
            <div className="word-dir">
              {dir === 'ja' ? '英単語に合う和訳をローマ字で入力' : '意味に合う英単語を入力'}
            </div>
            <p className="word-prompt">
              {q.question.promptKana ? (
                <RubyText ja={q.question.prompt} kana={q.question.promptKana} />
              ) : (
                q.question.prompt
              )}
            </p>
            <div className={`word-input ${q.hasError ? 'error' : ''}`}>
              {q.input ? q.input : ' '}
              {q.picked === null && <span className="caret">▍</span>}
            </div>
          </div>
          <div className="quiz-options">
            {q.question.options.map((opt, i) => {
              let cls = 'quiz-option'
              if (q.picked !== null) {
                if (opt.answer) cls += ' correct'
                else if (opt === q.picked) cls += ' wrong'
                else cls += ' dim'
              } else if (q.input) {
                cls += opt.variants.some((v) => v.startsWith(q.input)) ? ' cand' : ' dim'
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => (q.picked === null ? q.pick(opt) : q.advance())}
                >
                  <QuizOptionLabel opt={opt} input={q.input} picked={q.picked} hasError={q.hasError} />
                </button>
              )
            })}
          </div>
          <p className="hint">
            {q.picked === null ? (
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

function WordResult({ result, records, level, theme, mode, onRetry, onExit }) {
  const list = records[wordRecKey(level, theme, mode, result.endCondition)] || []
  const { open, modal } = useRecordDetail()
  const isQuiz = mode.startsWith('quiz')
  // 問題数制は主成績＝正解数（一発正解した問題数）。時間/文字数制は従来どおりタイピング数。
  const isItems = (result.endCondition?.kind ?? 'time') === 'items'
  return (
    <div className="result">
      <h2>記録</h2>
      <div className="result-main">
        <div className="result-speed">{isItems ? (result.correctCount ?? 0) : (result.keys ?? 0)}</div>
        <div className="result-unit">{isItems ? '正解（問）' : 'タイピング数'}</div>
      </div>
      {isItems ? (
        <div className="result-sub">
          <span>正解 {result.correctCount ?? 0}/{result.endCondition?.value ?? 0}問</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      ) : isQuiz ? (
        <div className="result-sub">
          <span>速度 {result.speed} 打/分</span>
          <span>正解 {result.correct}/{result.words}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      ) : (
        <div className="result-sub">
          <span>速度 {result.speed} 打/分</span>
          <span>ミス {result.mistakes}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      )}
      <div className="ending-actions">
        <button className="btn-primary" onClick={onRetry}>
          もう一度
        </button>
        <button className="story-exit" onClick={onExit}>
          トップへ
        </button>
      </div>
      <p className="key-hint">
        <kbd>Enter</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
      </p>

      <SegStatsTable segStats={result.segStats} />
      <div className="records">
        <h3>記録ランキング（最大15件）</h3>
        {list.length === 0 ? (
          <p className="no-records">まだ記録がありません。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{isItems ? '正解' : 'タイピング数'}</th>
                <th>正確率</th>
                <th>時間</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr
                  key={i}
                  className={`row-click ${r.date === result.date ? 'me' : ''}`}
                  onClick={() => open(r, i + 1, { rankText: '単語', list, isQuiz })}
                  title="クリックで記録の詳細"
                >
                  <td>{i + 1}</td>
                  <td className="speed">{isItems ? (r.correctCount ?? 0) : (r.keys ?? 0)}</td>
                  <td>{r.accuracy}%</td>
                  <td>{r.seconds}秒</td>
                  <td className="date">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal}
    </div>
  )
}
