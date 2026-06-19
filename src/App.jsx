import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORDS } from './words.js'
import { romajiVariants, displayRomaji } from './romaji.js'

const TARGET_KEYS = 600 // タイピング数(正しく打った文字数)がこの数に達したら終了
const MAX_RECORDS = 15
const STORAGE_KEY = 'typing-records-v1'

// 出題シーケンスを作る。各単語につき「英語表示(英語入力)」→「和訳表示(ローマ字入力)」。
function buildPrompts() {
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5)
  const prompts = []
  const pushWord = (w) => {
    prompts.push({ mode: 'en', show: w.en, variants: [w.en] })
    prompts.push({ mode: 'ja', show: w.ja, reading: w.kana, variants: romajiVariants(w.kana) })
  }
  for (const w of shuffled) pushWord(w)
  // 600打に足りなければ繰り返し追加
  const total = () => prompts.reduce((n, p) => n + p.variants[0].length, 0)
  while (total() < TARGET_KEYS + 80) for (const w of shuffled) pushWord(w)
  return prompts
}

function loadRecords() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveRecord(record) {
  const records = loadRecords()
  records.push(record)
  records.sort((a, b) => b.speed - a.speed) // 速い順
  const top = records.slice(0, MAX_RECORDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(top))
  return top
}

export default function App() {
  const [phase, setPhase] = useState('ready') // ready | playing | result
  const [prompts, setPrompts] = useState([])
  const [index, setIndex] = useState(0) // 現在の出題
  const [input, setInput] = useState('') // 現在の単語に対して打ったローマ字/英字
  const [typedKeys, setTypedKeys] = useState(0) // 正しく打った総文字数(=タイピング数)
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false) // 直近キーが誤りでブロック中
  const [now, setNow] = useState(0)
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)

  const startTimeRef = useRef(null)
  const current = prompts[index]

  // 経過時間の表示更新
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [phase])

  const startGame = useCallback(() => {
    setPrompts(buildPrompts())
    setIndex(0)
    setInput('')
    setTypedKeys(0)
    setMistakes(0)
    setHasError(false)
    setNow(0)
    startTimeRef.current = null
    setPhase('playing')
  }, [])

  const finishGame = useCallback((totalKeys, totalMistakes, endTime) => {
    const elapsedMs = endTime - startTimeRef.current
    const minutes = elapsedMs / 60000
    const speed = minutes > 0 ? Math.round(totalKeys / minutes) : 0
    const denom = totalKeys + totalMistakes
    const accuracy = denom > 0 ? Math.round((totalKeys / denom) * 100) : 100
    const record = {
      speed,
      keys: totalKeys,
      mistakes: totalMistakes,
      accuracy,
      seconds: Math.round(elapsedMs / 100) / 10,
      date: new Date().toLocaleString('ja-JP'),
    }
    setRecords(saveRecord(record))
    setLastResult(record)
    setPhase('result')
  }, [])

  const handleKey = useCallback(
    (e) => {
      if (phase !== 'playing' || !current) return
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      const key = e.key.toLowerCase()
      const candidate = input + key
      const variants = current.variants

      if (variants.some((v) => v.startsWith(candidate))) {
        // 正しい入力
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        const newTyped = typedKeys + 1

        if (newTyped >= TARGET_KEYS) {
          setTypedKeys(newTyped)
          finishGame(newTyped, mistakes, performance.now())
          return
        }
        setTypedKeys(newTyped)

        if (variants.includes(candidate)) {
          // 単語クリア → 次の問題
          setIndex((i) => i + 1)
          setInput('')
        } else {
          setInput(candidate)
        }
      } else {
        // 誤り: 正しいキーを打つまで進めない。打ったものは消さない
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    },
    [phase, current, input, typedKeys, mistakes, finishGame],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const started = startTimeRef.current !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const minutes = (now - startTimeRef.current) / 60000
    return minutes > 0 ? Math.round(typedKeys / minutes) : 0
  }, [now, typedKeys, started])

  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTimeRef.current) / 100) / 10
  }, [now, started])

  return (
    <div className="app">
      <h1>英単語タイピング</h1>

      {phase === 'ready' && <Ready onStart={startGame} records={records} />}

      {phase === 'playing' && current && (
        <div className="game">
          <div className="stats">
            <Stat label="タイピング数" value={`${typedKeys} / ${TARGET_KEYS}`} />
            <Stat label="速度" value={`${liveSpeed} 打/分`} />
            <Stat label="ミス" value={mistakes} />
            <Stat label="時間" value={`${elapsedSec} 秒`} />
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(typedKeys / TARGET_KEYS) * 100}%` }}
            />
          </div>

          <div className={`prompt mode-${current.mode}`}>
            <div className="prompt-mode">
              {current.mode === 'en' ? '英単語を入力' : '和訳 → ローマ字で入力'}
            </div>
            <div className="prompt-show">{current.show}</div>
            {current.reading && <div className="prompt-reading">{current.reading}</div>}
          </div>

          <WordDisplay
            text={displayRomaji(current.variants, input)}
            pos={input.length}
            hasError={hasError}
          />

          <p className="hint">
            正しく入力するまで次に進めません。ミスしても打ち直すだけでOK。
          </p>
        </div>
      )}

      {phase === 'result' && lastResult && (
        <Result result={lastResult} records={records} onRetry={startGame} />
      )}
    </div>
  )
}

function Ready({ onStart, records }) {
  return (
    <div className="ready">
      <p className="lead">
        英単語と和訳が交互に出ます。<strong>英語表示は英語スペル</strong>、
        <strong>和訳表示はローマ字</strong>で入力してください。<br />
        {TARGET_KEYS}打で終了し、記録が出ます。
      </p>
      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <RecordsTable records={records} />
    </div>
  )
}

function WordDisplay({ text, pos, hasError }) {
  return (
    <div className={`word-display ${hasError ? 'error' : ''}`}>
      {text.split('').map((ch, i) => {
        let cls = 'char'
        if (i < pos) cls += ' done'
        else if (i === pos) cls += hasError ? ' current err' : ' current'
        return (
          <span key={i} className={cls}>
            {ch}
          </span>
        )
      })}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function Result({ result, records, onRetry }) {
  return (
    <div className="result">
      <h2>記録</h2>
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
      <button className="btn-primary" onClick={onRetry}>
        もう一度
      </button>
      <RecordsTable records={records} highlight={result.date} />
    </div>
  )
}

function RecordsTable({ records, highlight }) {
  return (
    <div className="records">
      <h3>記録ランキング（速い順・最大{MAX_RECORDS}件）</h3>
      {records.length === 0 ? (
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
            {records.map((r, i) => (
              <tr key={i} className={highlight && r.date === highlight ? 'me' : ''}>
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
  )
}
