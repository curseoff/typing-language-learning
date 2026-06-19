import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SENTENCES } from './sentences.js'
import { romajiVariants, toRomaji } from './romaji.js'

const TARGET_KEYS = 600 // この文字数を打ち切ったら終了
const MAX_RECORDS = 15
const STORAGE_KEY = 'typing-records-v1'

// 「英文(英語入力)」→「和文(ローマ字入力)」を交互に連結したパッセージを作る。
// 各セグメントは末尾にスペース(区切り)を含み、それも打鍵対象。
// 和文は複数のローマ字入力を許容(variants)し、表示用に canonical(ヘボン式)を持つ。
function buildPassage() {
  const shuffled = [...SENTENCES].sort(() => Math.random() - 0.5)
  const segments = []
  let approx = 0
  const add = (seg) => {
    segments.push(seg)
    approx += seg.canonical.length
  }
  let idx = 0
  while (approx < TARGET_KEYS + 60) {
    const s = shuffled[idx % shuffled.length]
    add({
      type: 'en',
      en: s.en,
      ja: s.ja,
      kana: s.kana,
      variants: [s.en + ' '],
      canonical: s.en + ' ',
    })
    add({
      type: 'ja',
      en: s.en,
      ja: s.ja,
      kana: s.kana,
      variants: romajiVariants(s.kana).map((v) => v + ' '),
      canonical: toRomaji(s.kana) + ' ',
    })
    idx += 1
  }
  return segments
}

// 入力中セグメントの表示ローマ字。canonical を優先しつつ、入力に合う最短に切り替える。
function guideText(seg, input) {
  if (seg.canonical.startsWith(input)) return seg.canonical
  let best = null
  for (const v of seg.variants) {
    if (v.startsWith(input) && (best === null || v.length < best.length)) best = v
  }
  return best ?? seg.canonical
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
  const [segments, setSegments] = useState([])
  const [segIndex, setSegIndex] = useState(0)
  const [segInput, setSegInput] = useState('') // 現在セグメントに打ったローマ字/英字
  const [completed, setCompleted] = useState([]) // 確定したセグメントの入力文字列
  const [typedKeys, setTypedKeys] = useState(0) // 正しく打った総文字数
  const [mistakes, setMistakes] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [now, setNow] = useState(0)
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)

  const startTimeRef = useRef(null)

  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [phase])

  const startGame = useCallback(() => {
    setSegments(buildPassage())
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    setTypedKeys(0)
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

      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別(英文の大文字/ローマ字小文字)

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        if (startTimeRef.current === null) startTimeRef.current = performance.now()
        setHasError(false)
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)

        if (newKeys >= TARGET_KEYS) {
          finishGame(newKeys, mistakes, performance.now())
          return
        }

        if (seg.variants.includes(candidate)) {
          // セグメント確定 → 次へ
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setSegInput('')
        } else {
          setSegInput(candidate)
        }
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    },
    [phase, segments, segIndex, segInput, typedKeys, mistakes, finishGame],
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

  const currentSeg = segments[segIndex]

  return (
    <div className="app">
      <h1>英文・和文タイピング</h1>

      {phase === 'ready' && <Ready onStart={startGame} records={records} />}

      {phase === 'playing' && (
        <div className="game">
          <div className="stats">
            <Stat label="タイピング数" value={`${typedKeys} / ${TARGET_KEYS}`} />
            <Stat label="速度" value={`${liveSpeed} 打/分`} />
            <Stat label="ミス" value={mistakes} />
            <Stat label="時間" value={`${elapsedSec} 秒`} />
          </div>

          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(typedKeys / TARGET_KEYS) * 100}%` }} />
          </div>

          {currentSeg && <Reference seg={currentSeg} />}

          <Passage
            segments={segments}
            segIndex={segIndex}
            segInput={segInput}
            completed={completed}
            hasError={hasError}
          />

          <p className="hint">
            英文はそのまま、和文はローマ字で（shi/si など自由）。正しく打つまで次に進めません。
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
        <strong>英文は英語スペル</strong>、<strong>和文はローマ字</strong>（shi/si どちらでもOK）。
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

function Passage({ segments, segIndex, segInput, completed, hasError }) {
  let global = 0
  return (
    <div className="passage">
      {segments.map((seg, i) => {
        let text
        let typedLen
        if (i < segIndex) {
          text = completed[i] ?? seg.canonical
          typedLen = text.length
        } else if (i === segIndex) {
          text = guideText(seg, segInput)
          typedLen = segInput.length
        } else {
          text = seg.canonical
          typedLen = 0
        }
        const spans = text.split('').map((ch, j) => {
          let cls = 'ch'
          if (j < typedLen) cls += ' done'
          else if (i === segIndex && j === typedLen) cls += hasError ? ' cur err' : ' cur'
          if (global + j >= TARGET_KEYS) cls += ' over'
          return (
            <span key={j} className={cls}>
              {ch}
            </span>
          )
        })
        global += text.length
        return <span key={i}>{spans}</span>
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
