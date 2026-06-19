import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SENTENCES } from './sentences.js'
import { toRomaji } from './romaji.js'

const TARGET_KEYS = 600 // この文字数を打ち切ったら終了
const MAX_RECORDS = 15
const STORAGE_KEY = 'typing-records-v1'
const SEP = ' ' // 文と文の区切り(これも打つ)

// 「英文(英語入力)」→「和文(ローマ字入力)」を交互に連結したパッセージを作る。
// 全文を最初から表示するため、入力対象は固定文字列。
function buildPassage() {
  const shuffled = [...SENTENCES].sort(() => Math.random() - 0.5)
  const segments = []
  let target = ''

  const addSeg = (seg) => {
    if (target.length > 0) target += SEP // 区切りも打鍵対象
    const start = target.length
    target += seg.text
    segments.push({ ...seg, start, end: target.length })
  }

  let idx = 0
  // 600文字を十分に超えるまで文ペアを足す(足りなければ先頭から繰り返す)
  while (target.length < TARGET_KEYS + 60) {
    const s = shuffled[idx % shuffled.length]
    addSeg({ type: 'en', text: s.en, en: s.en, ja: s.ja, kana: s.kana })
    addSeg({ type: 'ja', text: toRomaji(s.kana), ja: s.ja, kana: s.kana, en: s.en })
    idx += 1
  }
  return { target, segments }
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
  const [passage, setPassage] = useState({ target: '', segments: [] })
  const [pos, setPos] = useState(0) // 正しく打った文字数(=カーソル位置)
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [now, setNow] = useState(0)
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)

  const startTimeRef = useRef(null)
  const { target, segments } = passage

  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [phase])

  const startGame = useCallback(() => {
    setPassage(buildPassage())
    setPos(0)
    setMistakes(0)
    setHasError(false)
    setNow(0)
    startTimeRef.current = null
    setPhase('playing')
  }, [])

  const finishGame = useCallback((keys, totalMistakes, endTime) => {
    const elapsedMs = endTime - startTimeRef.current
    const minutes = elapsedMs / 60000
    const speed = minutes > 0 ? Math.round(keys / minutes) : 0
    const denom = keys + totalMistakes
    const accuracy = denom > 0 ? Math.round((keys / denom) * 100) : 100
    const record = {
      speed,
      keys,
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
      if (phase !== 'playing') return
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      const expected = target[pos]
      if (e.key === expected) {
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        const newPos = pos + 1
        if (newPos >= TARGET_KEYS) {
          setPos(newPos)
          finishGame(newPos, mistakes, performance.now())
          return
        }
        setPos(newPos)
      } else {
        // 誤り: 正しいキーを打つまで進めない(打ったものは消さない)
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    },
    [phase, target, pos, mistakes, finishGame],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const started = startTimeRef.current !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const minutes = (now - startTimeRef.current) / 60000
    return minutes > 0 ? Math.round(pos / minutes) : 0
  }, [now, pos, started])

  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTimeRef.current) / 100) / 10
  }, [now, started])

  // 現在カーソルがいるセグメント(学習用の参照表示に使う)
  const currentSeg = useMemo(
    () => segments.find((s) => pos < s.end) ?? segments[segments.length - 1],
    [segments, pos],
  )

  return (
    <div className="app">
      <h1>英文・和文タイピング</h1>

      {phase === 'ready' && <Ready onStart={startGame} records={records} />}

      {phase === 'playing' && (
        <div className="game">
          <div className="stats">
            <Stat label="タイピング数" value={`${pos} / ${TARGET_KEYS}`} />
            <Stat label="速度" value={`${liveSpeed} 打/分`} />
            <Stat label="ミス" value={mistakes} />
            <Stat label="時間" value={`${elapsedSec} 秒`} />
          </div>

          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(pos / TARGET_KEYS) * 100}%` }} />
          </div>

          {currentSeg && <Reference seg={currentSeg} />}

          <Passage target={target} pos={pos} hasError={hasError} />

          <p className="hint">
            英文はそのまま、和文はローマ字で。正しく打つまで次に進めません。
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
        英文と和文が交互につながった文章を、最初から最後まで打ちます。<br />
        <strong>英文は英語スペル</strong>、<strong>和文はローマ字</strong>で入力。
        {TARGET_KEYS}文字で終了し、記録が出ます。
      </p>
      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <RecordsTable records={records} />
    </div>
  )
}

function Reference({ seg }) {
  return (
    <div className="reference">
      <div className={`ref-row ${seg.type === 'en' ? 'active' : ''}`}>
        <span className="ref-tag en">英語</span>
        <span className="ref-text">{seg.en}</span>
      </div>
      <div className={`ref-row ${seg.type === 'ja' ? 'active' : ''}`}>
        <span className="ref-tag ja">日本語</span>
        <span className="ref-text">{seg.ja}</span>
        <span className="ref-kana">{seg.kana}</span>
      </div>
    </div>
  )
}

function Passage({ target, pos, hasError }) {
  return (
    <div className="passage">
      {target.split('').map((ch, i) => {
        let cls = 'ch'
        if (i < pos) cls += ' done'
        else if (i === pos) cls += hasError ? ' cur err' : ' cur'
        // 末尾を超えた分(600以降)は薄く
        if (i >= TARGET_KEYS) cls += ' over'
        return (
          <span key={i} className={cls}>
            {ch === ' ' ? ' ' : ch}
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
