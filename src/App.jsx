import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORDS } from './words.js'

const TARGET_KEYS = 600 // タイピング数(正しく打った文字数)がこの数に達したら終了
const MAX_RECORDS = 15
const STORAGE_KEY = 'typing-records-v1'

// 単語ペアから出題シーケンスを作る。
// 各単語につき「英語表示」→「和訳表示」の順で2問。入力対象は常に英単語。
function buildPrompts() {
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5)
  const prompts = []
  for (const w of shuffled) {
    prompts.push({ mode: 'en', show: w.en, target: w.en })
    prompts.push({ mode: 'ja', show: w.ja, target: w.en })
  }
  // 600打に届くようループで足りなければ繰り返す
  while (prompts.reduce((n, p) => n + p.target.length, 0) < TARGET_KEYS + 50) {
    for (const w of shuffled) {
      prompts.push({ mode: 'en', show: w.en, target: w.en })
      prompts.push({ mode: 'ja', show: w.ja, target: w.en })
    }
  }
  return prompts
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
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
  const [pos, setPos] = useState(0) // 現在の単語内で正しく打った文字数
  const [typedKeys, setTypedKeys] = useState(0) // 正しく打った総文字数(=タイピング数)
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false) // 直近キーが誤りでブロック中
  const [now, setNow] = useState(0)
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)

  const startTimeRef = useRef(null)

  const current = prompts[index]

  // 経過時間の表示更新(1問目の最初の正しいキーで計測開始)
  useEffect(() => {
    if (phase !== 'playing' || startTimeRef.current === null) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [phase, startTimeRef.current])

  const startGame = useCallback(() => {
    setPrompts(buildPrompts())
    setIndex(0)
    setPos(0)
    setTypedKeys(0)
    setMistakes(0)
    setHasError(false)
    setNow(0)
    startTimeRef.current = null
    setPhase('playing')
  }, [])

  const finishGame = useCallback(
    (totalKeys, totalMistakes, endTime) => {
      const elapsedMs = endTime - startTimeRef.current
      const minutes = elapsedMs / 60000
      const speed = minutes > 0 ? Math.round(totalKeys / minutes) : 0
      const accuracy =
        totalKeys + totalMistakes > 0
          ? Math.round((totalKeys / (totalKeys + totalMistakes)) * 100)
          : 100
      const record = {
        speed,
        keys: totalKeys,
        mistakes: totalMistakes,
        accuracy,
        seconds: Math.round(elapsedMs / 100) / 10,
        date: new Date().toLocaleString('ja-JP'),
      }
      const top = saveRecord(record)
      setRecords(top)
      setLastResult(record)
      setPhase('result')
    },
    [],
  )

  const handleKey = useCallback(
    (e) => {
      if (phase !== 'playing' || !current) return
      // 1文字キーのみ対象(Shift, Enter, 矢印などは無視)
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      const expected = current.target[pos]
      if (e.key === expected) {
        // 計測開始
        if (startTimeRef.current === null) startTimeRef.current = performance.now()

        setHasError(false)
        const newTypedKeys = typedKeys + 1
        const newPos = pos + 1

        if (newTypedKeys >= TARGET_KEYS) {
          setTypedKeys(newTypedKeys)
          finishGame(newTypedKeys, mistakes, performance.now())
          return
        }

        setTypedKeys(newTypedKeys)
        if (newPos >= current.target.length) {
          // 単語クリア→次の問題
          setIndex((i) => i + 1)
          setPos(0)
        } else {
          setPos(newPos)
        }
      } else {
        // 誤り:正しいキーを打つまで進めない。打った文字は消さない(表示はそのまま)
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    },
    [phase, current, pos, typedKeys, mistakes, finishGame],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const liveSpeed = useMemo(() => {
    if (startTimeRef.current === null || now === 0) return 0
    const minutes = (now - startTimeRef.current) / 60000
    return minutes > 0 ? Math.round(typedKeys / minutes) : 0
  }, [now, typedKeys])

  const elapsedSec = useMemo(() => {
    if (startTimeRef.current === null || now === 0) return 0
    return Math.round((now - startTimeRef.current) / 100) / 10
  }, [now])

  return (
    <div className="app">
      <h1>英単語タイピング</h1>

      {phase === 'ready' && (
        <Ready onStart={startGame} records={records} />
      )}

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
              {current.mode === 'en' ? '英単語' : '和訳 → 英語で入力'}
            </div>
            <div className="prompt-show">{current.show}</div>
          </div>

          <WordDisplay
            target={current.target}
            pos={pos}
            hasError={hasError}
          />

          <p className="hint">
            正しく入力するまで次に進めません。ミスしても打ち直すだけでOK。
          </p>
        </div>
      )}

      {phase === 'result' && lastResult && (
        <Result
          result={lastResult}
          records={records}
          onRetry={startGame}
        />
      )}
    </div>
  )
}

function Ready({ onStart, records }) {
  return (
    <div className="ready">
      <p className="lead">
        英単語と和訳が交互に出ます。表示されている単語の<strong>英語スペル</strong>を入力してください。<br />
        {TARGET_KEYS}打で終了し、記録が出ます。
      </p>
      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <RecordsTable records={records} />
    </div>
  )
}

function WordDisplay({ target, pos, hasError }) {
  return (
    <div className={`word-display ${hasError ? 'error' : ''}`}>
      {target.split('').map((ch, i) => {
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
              <tr
                key={i}
                className={highlight && r.date === highlight ? 'me' : ''}
              >
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
