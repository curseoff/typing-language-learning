// 単語問題の画面。入力モード（英語/日本語/英語・日本語）と4択クイズを振り分ける。
import { useWords } from '../../application/useWords.js'
import { useWordQuiz } from '../../application/useWordQuiz.js'
import { wordRecKey } from '../../infrastructure/wordsRepository.js'
import { StatsRow } from '../shared/index.js'
import TopFlow from '../marathon/TopFlow.jsx'
import Passage from '../marathon/Passage.jsx'

export default function WordsView({ level, theme, mode, levelLabel, modeLabel, onExit }) {
  const meta = (
    <div className="play-meta">
      <span className="meta-badge rank">{levelLabel}</span>
      <span className="meta-badge mode">{modeLabel} / {theme}</span>
    </div>
  )
  return mode.startsWith('quiz') ? (
    <QuizView
      level={level}
      theme={theme}
      mode={mode}
      dir={mode === 'quiz-ja' ? 'ja' : 'en'}
      meta={meta}
      onExit={onExit}
    />
  ) : (
    <TypeView level={level} theme={theme} mode={mode} meta={meta} onExit={onExit} />
  )
}

// 入力モード（英語/日本語/英語・日本語）。文章モードと同じ上部フロー＋下部本文。
function TypeView({ level, theme, mode, meta, onExit }) {
  const w = useWords({ level, theme, mode, onExit })

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
              { label: 'タイピング数', value: `${w.typedKeys} / ${w.target}` },
              { label: '速度', value: `${w.liveSpeed} 打/分` },
              { label: 'ミス', value: w.mistakes },
              { label: '時間', value: `${w.elapsedSec} 秒` },
            ]}
            progress={w.progress}
          />
          <TopFlow segments={w.segments} segIndex={w.segIndex} segInput={w.segInput} />
          <Passage
            segments={w.segments}
            segIndex={w.segIndex}
            segInput={w.segInput}
            completed={w.completed}
            hasError={w.hasError}
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
function QuizView({ level, theme, mode, dir, meta, onExit }) {
  const q = useWordQuiz({ level, theme, dir, mode, onExit })

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
              { label: '問題', value: `${q.index} / ${q.total}` },
              { label: '正解', value: q.correct },
              { label: 'ミス', value: q.mistakes },
              { label: '時間', value: `${q.elapsedSec} 秒` },
            ]}
            progress={q.index / q.total}
          />
          <div className="word-card">
            <div className="word-dir">
              {dir === 'ja' ? '英単語に合う和訳をローマ字で入力' : '意味に合う英単語を入力'}
            </div>
            <p className="word-prompt">{q.question.prompt}</p>
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
                  {opt.display}
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
  const list = records[wordRecKey(level, theme, mode)] || []
  const isQuiz = mode.startsWith('quiz')
  return (
    <div className="result">
      <h2>記録</h2>
      {isQuiz ? (
        <>
          <div className="result-main">
            <div className="result-speed">
              {result.correct}/{result.words}
            </div>
            <div className="result-unit">正解</div>
          </div>
          <div className="result-sub">
            <span>正確率 {result.accuracy}%</span>
            <span>{result.seconds} 秒</span>
          </div>
        </>
      ) : (
        <>
          <div className="result-main">
            <div className="result-speed">{result.speed}</div>
            <div className="result-unit">打/分</div>
          </div>
          <div className="result-sub">
            <span>{result.keys} 打</span>
            <span>{result.seconds} 秒</span>
            <span>ミス {result.mistakes}</span>
            <span>正確率 {result.accuracy}%</span>
          </div>
        </>
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

      <div className="records">
        <h3>記録ランキング（最大15件）</h3>
        {list.length === 0 ? (
          <p className="no-records">まだ記録がありません。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{isQuiz ? '正解' : '速度'}</th>
                <th>正確率</th>
                <th>時間</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className={r.date === result.date ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td className="speed">{isQuiz ? `${r.correct}/${r.words}` : `${r.speed} 打/分`}</td>
                  <td>{r.accuracy}%</td>
                  <td>{r.seconds}秒</td>
                  <td className="date">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
