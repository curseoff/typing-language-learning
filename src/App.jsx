import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SENTENCES, RANKS } from './sentences.js'
import { romajiVariants, toRomaji, kanaConsumed } from './romaji.js'
import {
  alignJaToKana,
  consumedWords,
  enWords,
  guideText,
  jaPunct,
  scramble,
} from './typing.js'
import { Chars, Chips, Flow, MaskedText, StatsRow } from './ui.jsx'
import StoryMode from './StoryMode.jsx'

const TARGET_KEYS = 600 // この文字数を打ち切ったら終了
const MAX_RECORDS = 15
const STORAGE_KEY = 'typing-records-v3'
const OLD_STORAGE_KEY = 'typing-records-v2'

export const MODES = [
  { key: 'both', label: '英語・日本語' },
  { key: 'en', label: '英語' },
  { key: 'ja', label: '日本語' },
  { key: 'en-tr', label: '英語訳' },
  { key: 'ja-tr', label: '日本語訳' },
]

// モードに応じてパッセージ(セグメント列)を作る。
// both: 英文→和文 を交互 / en: 英文のみ / ja: 和文のみ /
// en-tr(英訳): 和文を見て英語を入力 / ja-tr(和訳): 英文を見てローマ字を入力。
// 翻訳モードは打つ文章を伏せ、単語チップ(chips)をヒントに出す。
function buildPassage(mode, rank) {
  const pool = SENTENCES.filter((s) => s.rank === rank)
  const base = pool.length > 0 ? pool : SENTENCES
  const shuffled = [...base].sort(() => Math.random() - 0.5)
  const segments = []
  let approx = 0
  let si = 0 // 文の通し番号
  let idx = 0
  const pushSeg = (seg) => {
    segments.push(seg)
    approx += seg.canonical.length
  }
  while (approx < TARGET_KEYS + 60) {
    const s = shuffled[idx % shuffled.length]
    const base = { sentenceIndex: si, en: s.en, ja: s.ja, kana: s.kana }
    if (mode === 'en-tr') {
      const words = enWords(s.en)
      pushSeg({ ...base, type: 'en', variants: [s.en], canonical: s.en, translate: true, words, chips: scramble(words.map((text, i) => ({ text, i }))) })
    } else if (mode === 'ja-tr') {
      const p = jaPunct(s.ja)
      const words = p ? [...s.jaWords, p] : [...s.jaWords]
      pushSeg({ ...base, type: 'ja', variants: romajiVariants(s.kana), canonical: toRomaji(s.kana), translate: true, words, chips: scramble(words.map((text, i) => ({ text, i }))) })
    } else {
      if (mode !== 'ja') pushSeg({ ...base, type: 'en', variants: [s.en], canonical: s.en })
      if (mode !== 'en') pushSeg({ ...base, type: 'ja', variants: romajiVariants(s.kana), canonical: toRomaji(s.kana) })
    }
    si += 1
    idx += 1
  }
  return segments
}

// 記録は モード×ランク 別: キーは `${mode}__r${rank}`
function recKey(mode, rank) {
  return `${mode}__r${rank}`
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj
    }
    // v2(モード別) からの移行: ランク1へ
    const v2 = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null')
    if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
      const out = {}
      for (const m of Object.keys(v2)) out[recKey(m, 1)] = v2[m]
      return out
    }
  } catch {
    // 破損時は空で開始
  }
  return {}
}

function saveRecord(record) {
  const all = loadRecords()
  const key = recKey(record.mode, record.rank)
  const list = [...(all[key] || []), record]
  list.sort((a, b) => b.speed - a.speed) // 速い順
  all[key] = list.slice(0, MAX_RECORDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}

function modeLabel(key) {
  return MODES.find((m) => m.key === key)?.label ?? key
}

function rankLabel(rank) {
  const r = RANKS.find((x) => x.rank === rank)
  return r ? `R${r.rank} ${r.label}` : `R${rank}`
}

function modeDesc(key) {
  switch (key) {
    case 'en':
      return '英文だけを連続で入力します。'
    case 'ja':
      return '和文だけをローマ字で連続入力します。'
    case 'en-tr':
      return '和文を見て英語に翻訳。単語チップがヒント。入力は伏せられ、正しく打つと現れます。'
    case 'ja-tr':
      return '英文を見て日本語(ローマ字)に翻訳。単語チップがヒント。入力は伏せられ、正しく打つと現れます。'
    default:
      return '英文と和文を交互に入力します。'
  }
}

export default function App() {
  const [phase, setPhase] = useState('ready') // ready | playing | result
  const [mode, setMode] = useState('both') // both | en | ja | en-tr | ja-tr
  const [rank, setRank] = useState(1) // 1-6
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
  const [segStats, setSegStats] = useState([]) // 問題ごとの記録(結果表示用)

  const startTimeRef = useRef(null)
  const segStartRef = useRef(null) // 現在の問題の開始時刻
  const segMistakesRef = useRef(0) // 現在の問題のミス数
  const segStatsRef = useRef([]) // 確定した問題ごとの記録

  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [phase])

  const startGame = useCallback(() => {
    setSegments(buildPassage(mode, rank))
    setSegIndex(0)
    setSegInput('')
    setCompleted([])
    setTypedKeys(0)
    setMistakes(0)
    setHasError(false)
    setNow(0)
    setSegStats([])
    startTimeRef.current = null
    segStartRef.current = null
    segMistakesRef.current = 0
    segStatsRef.current = []
    setPhase('playing')
  }, [mode, rank])

  const finishGame = useCallback((keys, totalMistakes, endTime) => {
    const elapsedMs = endTime - startTimeRef.current
    const minutes = elapsedMs / 60000
    const speed = minutes > 0 ? Math.round(keys / minutes) : 0
    const denom = keys + totalMistakes
    const accuracy = denom > 0 ? Math.round((keys / denom) * 100) : 100
    const record = {
      mode,
      rank,
      speed,
      keys,
      mistakes: totalMistakes,
      accuracy,
      seconds: Math.round(elapsedMs / 100) / 10,
      date: new Date().toLocaleString('ja-JP'),
    }
    setRecords(saveRecord(record))
    setLastResult(record)
    setSegStats(segStatsRef.current)
    setPhase('result')
  }, [mode, rank])

  const handleKey = useCallback(
    (e) => {
      if (phase !== 'playing') return
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()

      const seg = segments[segIndex]
      if (!seg) return
      const candidate = segInput + e.key // 大文字小文字は区別(英文の大文字/ローマ字小文字)

      if (seg.variants.some((v) => v.startsWith(candidate))) {
        const t = performance.now()
        if (startTimeRef.current === null) startTimeRef.current = t
        if (segStartRef.current === null) segStartRef.current = t // 問題の最初の打鍵
        setHasError(false)
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)

        const completesSeg = seg.variants.includes(candidate)
        const reachedGoal = newKeys >= TARGET_KEYS

        // 問題が終わった(完了 or 600到達で打ち切り)ら記録
        if (completesSeg || reachedGoal) {
          const segKeys = candidate.length
          const ms = t - segStartRef.current
          segStatsRef.current = [
            ...segStatsRef.current,
            {
              no: segStatsRef.current.length + 1,
              type: seg.type,
              label: seg.type === 'en' ? seg.en : seg.ja,
              keys: segKeys,
              mistakes: segMistakesRef.current,
              seconds: Math.round(ms / 100) / 10,
              speed: ms > 0 ? Math.round(segKeys / (ms / 60000)) : 0,
              partial: !completesSeg, // 完了前に600到達で打ち切り
            },
          ]
          segStartRef.current = null
          segMistakesRef.current = 0
        }

        if (reachedGoal) {
          finishGame(newKeys, mistakes, t)
          return
        }

        if (completesSeg) {
          setCompleted((c) => [...c, candidate])
          setSegIndex((i) => i + 1)
          setSegInput('')
        } else {
          setSegInput(candidate)
        }
      } else {
        setMistakes((m) => m + 1)
        segMistakesRef.current += 1
        setHasError(true)
      }
    },
    [phase, segments, segIndex, segInput, typedKeys, mistakes, finishGame],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Space=スタート/もう一度、Esc=トップへ戻る
  useEffect(() => {
    const onNav = (e) => {
      if (e.key === 'Escape') {
        if (phase === 'playing' || phase === 'result') {
          e.preventDefault()
          setPhase('ready')
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        // タイピング中の Space は入力文字なので除外(ready/result のみ)
        if (phase === 'ready' || phase === 'result') {
          e.preventDefault()
          startGame()
        }
      } else if (phase === 'ready' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        // TOP画面で ←/→ でモード切り替え
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        setMode((prev) => {
          const i = MODES.findIndex((m) => m.key === prev)
          return MODES[(i + dir + MODES.length) % MODES.length].key
        })
      } else if (phase === 'ready' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // TOP画面で ↑/↓ でランク切り替え
        e.preventDefault()
        const dir = e.key === 'ArrowDown' ? 1 : -1
        setRank((prev) => Math.min(RANKS.length, Math.max(1, prev + dir)))
      }
    }
    window.addEventListener('keydown', onNav)
    return () => window.removeEventListener('keydown', onNav)
  }, [phase, startGame])

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

  // 開発時だけ：結果画面をダミーデータで即プレビュー（本番ビルドには含まれない）
  const previewResult = useCallback(() => {
    const mock = {
      mode,
      rank,
      speed: 480,
      keys: TARGET_KEYS,
      mistakes: 7,
      accuracy: 98,
      seconds: 75.0,
      date: new Date().toLocaleString('ja-JP'),
    }
    setLastResult(mock)
    setSegStats([
      { no: 1, type: 'en', label: 'I go to school every day.', keys: 24, mistakes: 1, seconds: 4.2, speed: 340, partial: false },
      { no: 2, type: 'ja', label: '私は毎日学校へ行きます。', keys: 30, mistakes: 2, seconds: 6.1, speed: 295, partial: false },
      { no: 3, type: 'en', label: 'The weather is nice today.', keys: 26, mistakes: 0, seconds: 3.9, speed: 400, partial: true },
    ])
    setRecords((prev) => ({
      ...prev,
      [recKey(mode, rank)]: [{ ...mock, speed: 520, date: '過去の記録' }, mock],
    }))
    setPhase('result')
  }, [mode, rank])

  return (
    <div className="app">
      <h1>英文・和文タイピング</h1>

      {import.meta.env.DEV && (
        <div className="dev-panel">
          <span className="dev-tag">DEV</span>
          <button onClick={() => setPhase('ready')}>トップ</button>
          <button onClick={previewResult}>結果(ダミー)</button>
          <button onClick={() => setPhase('story')}>物語</button>
        </div>
      )}

      {phase === 'ready' && (
        <Ready
          mode={mode}
          onModeChange={setMode}
          rank={rank}
          onRankChange={setRank}
          onStart={startGame}
          onStartStory={() => setPhase('story')}
          records={records}
        />
      )}

      {phase === 'story' && (
        <StoryMode mode={mode} modeLabel={modeLabel(mode)} onExit={() => setPhase('ready')} />
      )}

      {phase === 'playing' && (
        <div className="game">
          <div className="play-meta">
            <span className="meta-badge rank">{rankLabel(rank)}</span>
            <span className="meta-badge mode">{modeLabel(mode)}</span>
          </div>

          <StatsRow
            stats={[
              { label: 'タイピング数', value: `${typedKeys} / ${TARGET_KEYS}` },
              { label: '速度', value: `${liveSpeed} 打/分` },
              { label: 'ミス', value: mistakes },
              { label: '時間', value: `${elapsedSec} 秒` },
            ]}
            progress={typedKeys / TARGET_KEYS}
          />

          {currentSeg?.translate ? (
            <TranslateView
              segments={segments}
              segIndex={segIndex}
              segInput={segInput}
              hasError={hasError}
            />
          ) : (
            <>
              {currentSeg && (
                <TopFlow segments={segments} segIndex={segIndex} segInput={segInput} />
              )}
              <Passage
                segments={segments}
                segIndex={segIndex}
                segInput={segInput}
                completed={completed}
                hasError={hasError}
              />
            </>
          )}

          <p className="hint">
            {currentSeg?.translate
              ? 'チップを参考に訳を入力。正しく打つと文字が現れます。'
              : '英文はそのまま、和文はローマ字で（shi/si など自由）。正しく打つまで次に進めません。'}
            <kbd>Esc</kbd> で中断してトップへ。
          </p>
        </div>
      )}

      {phase === 'result' && lastResult && (
        <Result result={lastResult} records={records} segStats={segStats} onRetry={startGame} />
      )}
    </div>
  )
}

function Ready({ mode, onModeChange, rank, onRankChange, onStart, onStartStory, records }) {
  const courses = [...new Set(RANKS.map((r) => r.course))]
  return (
    <div className="ready">
      <p className="lead">
        日本人のための英語タイピング教材。レベル（日常会話→ビジネス会話）とモードを選んで開始。
        {TARGET_KEYS}文字で終了し、記録が出ます。
      </p>

      <div className="section-label">レベル</div>
      <div className="rank-select">
        {courses.map((course) => (
          <div className="rank-group" key={course}>
            <div className="rank-course">{course}</div>
            <div className="rank-btns">
              {RANKS.filter((r) => r.course === course).map((r) => (
                <button
                  key={r.rank}
                  className={`rank-btn ${rank === r.rank ? 'active' : ''}`}
                  onClick={() => onRankChange(r.rank)}
                >
                  <span className="rank-no">R{r.rank}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">モード</div>
      <div className="mode-select">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`mode-btn ${mode === m.key ? 'active' : ''}`}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mode-desc">{modeDesc(mode)}</p>

      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="key-hint">
        <kbd>↑</kbd> <kbd>↓</kbd> レベル / <kbd>←</kbd> <kbd>→</kbd> モード / <kbd>Space</kbd> スタート
      </p>

      <div className="story-entry">
        <div className="section-label">物語モード</div>
        <button className="btn-story" onClick={onStartStory}>
          📖 海外旅行アドベンチャー
        </button>
        <p className="mode-desc">
          上で選んだ「{modeLabel(mode)}」で物語を進め、選択肢で分岐。複数のエンドあり。
        </p>
      </div>

      <RecordsTable records={records[recKey(mode, rank)]} modeKey={mode} rank={rank} />
    </div>
  )
}

// 上部: 英語/日本語を横に流す（現在の文を中央へ）。データを組み立てて共有 Flow に渡す。
function TopFlow({ segments, segIndex, segInput }) {
  // 文ごとに1件(sentenceIndex で集約)
  const sentences = useMemo(() => {
    const map = new Map()
    for (const s of segments) if (!map.has(s.sentenceIndex)) map.set(s.sentenceIndex, s)
    return [...map.values()]
  }, [segments])
  const hasEn = useMemo(() => segments.some((s) => s.type === 'en'), [segments])
  const hasJa = useMemo(() => segments.some((s) => s.type === 'ja'), [segments])

  const seg = segments[segIndex]
  const cur = seg ? seg.sentenceIndex : 0
  const enActive = seg?.type === 'en'
  const jaActive = seg?.type === 'ja'

  // 英文の進捗（和文入力中は英文は完了済み）
  const enDone = !seg ? 0 : enActive ? Math.min(segInput.length, seg.en.length) : seg.en.length
  // 漢字の進捗（ローマ字の進捗を漢字位置に変換）
  const jaDone = useMemo(() => {
    if (!seg || !jaActive) return 0
    const consumed = kanaConsumed(seg.kana, segInput)
    const ends = alignJaToKana(seg.ja, seg.kana)
    let count = 0
    for (const e of ends) if (e <= consumed) count++
    return count
  }, [seg, jaActive, segInput])

  return (
    <Flow
      items={sentences}
      cur={cur}
      enDone={enDone}
      jaDone={jaDone}
      activeRow={enActive ? 'en' : jaActive ? 'ja' : null}
      showEn={hasEn}
      showJa={hasJa}
      scrollToCenter
    />
  )
}

// 翻訳モード(英訳/和訳)。上に原文、下に単語チップ、入力欄は伏せて打つと現れる。
function TranslateView({ segments, segIndex, segInput, hasError }) {
  const seg = segments[segIndex]
  if (!seg) return null
  const toEnglish = seg.type === 'en' // 英訳(和文→英語)
  const sourceOf = (s) => (s.type === 'en' ? s.ja : s.en)
  const next = segments[segIndex + 1]

  const target = guideText(seg, segInput) // 打つべき文字列(伏せて表示)
  const pos = segInput.length
  const used = consumedWords(seg, segInput) // 打ち終えた単語数

  return (
    <div className="translate">
      <div className="tr-task">{toEnglish ? '日本語を英語に訳す' : '英語を日本語に訳す'}</div>
      <div className="tr-source">{sourceOf(seg)}</div>
      {next && <div className="tr-next">次: {sourceOf(next)}</div>}

      <Chips chips={seg.chips} used={used} />

      <div className={`tr-input ${hasError ? 'error' : ''}`}>
        <MaskedText text={target} pos={pos} hasError={hasError} />
      </div>
    </div>
  )
}

// 下部本文: 600文字を最初から全文表示。英文は英字、和文は漢字のまま表示し、
// 打った位置を色分け(和文はローマ字入力の進捗を漢字位置に変換)。
function Passage({ segments, segIndex, segInput, completed, hasError }) {
  let g = 0 // 打鍵対象(romaji/英字)の通し文字数 → 600超過の判定に使う
  return (
    <div className={`passage ${hasError ? 'error' : ''}`}>
      {segments.map((seg, i) => {
        const state = i < segIndex ? 'done' : i === segIndex ? 'current' : 'future'
        const tgtLen =
          state === 'done'
            ? (completed[i] ?? seg.canonical).length
            : state === 'current'
              ? guideText(seg, segInput).length
              : seg.canonical.length
        const over = g >= TARGET_KEYS
        g += tgtLen

        // 表示文字列と「打ち終えた文字数」「カーソル位置」を決める
        let display
        let doneLen
        if (seg.type === 'ja') {
          display = seg.ja // 漢字のまま表示
          if (state === 'done') doneLen = [...seg.ja].length
          else if (state === 'current') {
            const consumed = kanaConsumed(seg.kana, segInput)
            const ends = alignJaToKana(seg.ja, seg.kana)
            doneLen = ends.filter((e) => e <= consumed).length
          } else doneLen = 0
        } else {
          display =
            state === 'done'
              ? completed[i] ?? seg.canonical
              : state === 'current'
                ? guideText(seg, segInput)
                : seg.canonical
          doneLen = state === 'done' ? display.length : state === 'current' ? segInput.length : 0
        }

        return (
          <span key={i}>
            {i > 0 && <span className="gap"> </span>}
            <Chars
              text={display}
              done={doneLen}
              cursor={state === 'current' ? doneLen : -1}
              hasError={hasError}
              over={over}
            />
          </span>
        )
      })}
    </div>
  )
}

function Result({ result, records, segStats, onRetry }) {
  return (
    <div className="result">
      <h2>記録</h2>
      <div className="result-mode">
        {rankLabel(result.rank)} ／ {modeLabel(result.mode)}
      </div>
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
      <p className="key-hint">
        <kbd>Space</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
      </p>
      <SegStatsTable segStats={segStats} />
      <RecordsTable
        records={records[recKey(result.mode, result.rank)]}
        modeKey={result.mode}
        rank={result.rank}
        highlight={result.date}
      />
    </div>
  )
}

function SegStatsTable({ segStats }) {
  if (!segStats || segStats.length === 0) return null
  return (
    <div className="seg-stats">
      <h3>問題ごとの記録</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>種別</th>
            <th>問題</th>
            <th>速度</th>
            <th>ミス</th>
          </tr>
        </thead>
        <tbody>
          {segStats.map((s) => (
            <tr key={s.no} className={s.mistakes > 0 ? 'has-miss' : ''}>
              <td>{s.no}</td>
              <td>
                <span className={`type-badge ${s.type}`}>{s.type === 'en' ? '英' : '和'}</span>
              </td>
              <td className="q-label">
                {s.label}
                {s.partial && <span className="partial-tag">途中</span>}
              </td>
              <td className="speed">{s.speed} 打/分</td>
              <td className={s.mistakes > 0 ? 'miss' : ''}>{s.mistakes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordsTable({ records, modeKey, rank, highlight }) {
  const list = records || []
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rank != null && <span className="records-mode">{rankLabel(rank)}</span>}
        {modeKey && <span className="records-mode">{modeLabel(modeKey)}</span>}
        <span className="records-sub">（速い順・最大{MAX_RECORDS}件）</span>
      </h3>
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
