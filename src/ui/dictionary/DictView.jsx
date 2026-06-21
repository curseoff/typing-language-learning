// 英英辞典の画面。単語4択 / 説明4択 / 英語入力 / 日本語入力 を振り分ける。
import { useDict } from '../../application/useDict.js'
import { useDictQuiz } from '../../application/useDictQuiz.js'
import { dictRecKey } from '../../infrastructure/dictRepository.js'
import { kanjiDone } from '../../domain/typing/progress.js'
import { Chars, StatsRow } from '../shared/index.js'

export default function DictView({ level, theme, mode, levelLabel, modeLabel, onExit }) {
  const meta = (
    <div className="play-meta">
      <span className="meta-badge rank">{levelLabel}</span>
      <span className="meta-badge mode">英英 / {modeLabel} / {theme}</span>
    </div>
  )
  if (mode === 'quiz') return <QuizView level={level} theme={theme} meta={meta} onExit={onExit} />
  if (mode === 'pick') return <PickView level={level} theme={theme} meta={meta} onExit={onExit} />
  return <TypeView level={level} theme={theme} mode={mode} meta={meta} onExit={onExit} />
}

// 説明文4択：単語＋意味 → 合う説明文を「打って」選ぶ
function PickView({ level, theme, meta, onExit }) {
  const q = useDictQuiz({ level, theme, kind: 'pick', onExit })

  return (
    <div className="game">
      {meta}
      {q.finished ? (
        <DictResult result={q.result} records={q.records} level={level} theme={theme} mode="pick" onRetry={q.restart} onExit={onExit} />
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
            <div className="word-dir">単語に合う説明文を入力</div>
            <p className="dict-head">{q.question.prompt}</p>
            <p className="dict-ref">{q.question.ja}</p>
            <div className={`word-input ${q.hasError ? 'error' : ''}`}>
              {q.input ? q.input : ' '}
              {q.picked === null && <span className="caret">▍</span>}
            </div>
          </div>
          <div className="pick-options">
            {q.question.options.map((opt, i) => {
              let cls = 'quiz-option pick-option'
              if (q.picked !== null) {
                if (opt.answer) cls += ' correct'
                else if (opt === q.picked) cls += ' wrong'
                else cls += ' dim'
              } else if (q.input) {
                cls += opt.variants.some((v) => v.startsWith(q.input)) ? ' cand' : ' dim'
              }
              return (
                <button key={i} className={cls} onClick={() => (q.picked === null ? q.pick(opt) : q.advance())}>
                  {opt.display}
                </button>
              )
            })}
          </div>
          <p className="hint">
            {q.picked === null ? (
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

// 英語入力（定義文を打つ）/ 日本語入力（和訳を打つ）
function TypeView({ level, theme, mode, meta, onExit }) {
  const d = useDict({ level, theme, mode, onExit })
  const seg = d.seg
  const isEn = mode === 'en'
  const jaProgress = isEn ? 0 : kanjiDone(seg, d.input)

  return (
    <div className="game">
      {meta}
      {d.finished ? (
        <DictResult result={d.result} records={d.records} level={level} theme={theme} mode={mode} onRetry={d.restart} onExit={onExit} />
      ) : (
        <>
          <StatsRow
            stats={[
              { label: '語数', value: `${d.index} / ${d.total}` },
              { label: '速度', value: `${d.liveSpeed} 打/分` },
              { label: 'ミス', value: d.mistakes },
              { label: '時間', value: `${d.elapsedSec} 秒` },
            ]}
            progress={d.index / d.total}
          />
          <div className="word-card">
            <div className="word-dir">{isEn ? '定義（英語）を入力' : '和訳を入力（ローマ字）'}</div>
            <p className="dict-head">{d.entry.word}</p>
            {isEn ? (
              <>
                <div className="dict-type">
                  <Chars text={seg.en} done={d.input.length} cursor={d.input.length} hasError={d.hasError} />
                </div>
                <p className="dict-ref">{d.entry.ja}</p>
              </>
            ) : (
              <>
                <p className="dict-ref">{seg.en}</p>
                <div className="dict-type">
                  <Chars text={seg.ja} done={jaProgress} cursor={jaProgress} hasError={d.hasError} />
                </div>
              </>
            )}
          </div>
          <p className="hint">
            見出し語の{isEn ? '英語の定義' : '和訳'}を入力。正しく打つまで次に進めません。
            <kbd>Esc</kbd> で中断。
          </p>
        </>
      )}
    </div>
  )
}

// 4択（定義→英単語をタイプ/クリック）
function QuizView({ level, theme, meta, onExit }) {
  const q = useDictQuiz({ level, theme, onExit })

  return (
    <div className="game">
      {meta}
      {q.finished ? (
        <DictResult result={q.result} records={q.records} level={level} theme={theme} mode="quiz" onRetry={q.restart} onExit={onExit} />
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
            <div className="word-dir">定義に合う英単語を入力</div>
            <p className="dict-def">{q.question.prompt}</p>
            {q.picked !== null && <p className="dict-ref">{q.question.ja}</p>}
            <div className={`word-input ${q.hasError ? 'error' : ''}`}>
              {q.input ? q.input : ' '}
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
                <button key={i} className={cls} onClick={() => (q.picked === null ? q.pick(opt) : q.advance())}>
                  {opt.display}
                </button>
              )
            })}
          </div>
          <p className="hint">
            {q.picked === null ? (
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

function DictResult({ result, records, level, theme, mode, onRetry, onExit }) {
  const list = records[dictRecKey(level, theme, mode)] || []
  const isQuiz = mode === 'quiz' || mode === 'pick' // 選択式＝正解数で表示
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
            <span>{result.words} 語</span>
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
