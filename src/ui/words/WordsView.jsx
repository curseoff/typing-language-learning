// 単語問題の画面（プレイ＋結果）。状態は useWords から受け取る。
import { useWords } from '../../application/useWords.js'
import { wordRecKey } from '../../infrastructure/wordsRepository.js'
import { Chars, StatsRow } from '../shared/index.js'

export default function WordsView({ level, theme, levelLabel, onExit }) {
  const w = useWords({ level, theme, onExit })

  return (
    <div className="game">
      <div className="play-meta">
        <span className="meta-badge rank">{levelLabel}</span>
        <span className="meta-badge mode">{theme}</span>
      </div>

      {w.finished ? (
        <WordResult result={w.result} records={w.records} level={level} theme={theme} onRetry={w.restart} onExit={onExit} />
      ) : (
        <>
          <StatsRow
            stats={[
              { label: '語数', value: `${w.index} / ${w.total}` },
              { label: '速度', value: `${w.liveSpeed} 打/分` },
              { label: 'ミス', value: w.mistakes },
              { label: '時間', value: `${w.elapsedSec} 秒` },
            ]}
            progress={w.index / w.total}
          />

          <div className="word-card">
            <p className="word-prompt">{w.words[w.index].ja}</p>
            <div className="word-input">
              <Chars
                text={w.words[w.index].en}
                done={w.input.length}
                cursor={w.input.length}
                hasError={w.hasError}
              />
            </div>
          </div>

          <p className="hint">
            和訳を見て英単語を入力。正しく打つまで次に進めません。<kbd>Esc</kbd> で中断してトップへ。
          </p>
        </>
      )}
    </div>
  )
}

function WordResult({ result, records, level, theme, onRetry, onExit }) {
  const list = records[wordRecKey(level, theme)] || []
  return (
    <div className="result">
      <h2>記録</h2>
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
        <h3>記録ランキング（速い順・最大15件）</h3>
        {list.length === 0 ? (
          <p className="no-records">まだ記録がありません。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>速度</th>
                <th>正確率</th>
                <th>時間</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className={r.date === result.date ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td className="speed">{r.speed} 打/分</td>
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
