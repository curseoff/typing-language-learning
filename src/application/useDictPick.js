// 英英辞典の「説明文4択」。単語(+和訳)に合う定義を1-4で選び→その定義を入力。N問で終了。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DICT_TYPE_COUNT, buildDictSet, levelEntries, makeDictPick } from '../domain/dictionary/dictset.js'
import { buildUnits, segMatches } from '../domain/typing/units.js'
import { score } from '../domain/marathon/scoring.js'
import { loadDictRecords, saveDictRecord } from '../infrastructure/dictRepository.js'

export function useDictPick({ level, theme, onExit }) {
  const build = () => makeDictPick(buildDictSet(level, theme, DICT_TYPE_COUNT), levelEntries(level))
  const [questions, setQuestions] = useState(build)
  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState('select') // select | type
  const [picked, setPicked] = useState(null) // 選んだ選択肢index
  const [input, setInput] = useState('')
  const [hasError, setHasError] = useState(false)
  const [typedKeys, setTypedKeys] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [correct, setCorrect] = useState(0) // 選択の正解数
  const [now, setNow] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadDictRecords())
  const startTimeRef = useRef(null)

  const q = questions[index]
  // 入力対象は常に「正解の定義」
  const seg = useMemo(() => buildUnits({ en: q.answerDef, ja: '', kana: '' }, 'en')[0], [q])

  const restart = useCallback(() => {
    setQuestions(makeDictPick(buildDictSet(level, theme, DICT_TYPE_COUNT), levelEntries(level)))
    setIndex(0)
    setStage('select')
    setPicked(null)
    setInput('')
    setHasError(false)
    setTypedKeys(0)
    setMistakes(0)
    setCorrect(0)
    setNow(0)
    setFinished(false)
    setResult(null)
    startTimeRef.current = null
  }, [level, theme])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [finished])

  const started = startTimeRef.current !== null
  const liveSpeed = useMemo(() => {
    if (!started || now === 0) return 0
    const min = (now - startTimeRef.current) / 60000
    return min > 0 ? Math.round(typedKeys / min) : 0
  }, [now, typedKeys, started])
  const elapsedSec = useMemo(() => {
    if (!started || now === 0) return 0
    return Math.round((now - startTimeRef.current) / 100) / 10
  }, [now, started])

  const finish = useCallback(
    (keys, totalMistakes, correctCount, endTime) => {
      const elapsedMs = endTime - startTimeRef.current
      const { speed, accuracy, seconds } = score({ keys, mistakes: totalMistakes, elapsedMs })
      const record = {
        level,
        theme,
        mode: 'pick',
        speed,
        keys,
        correct: correctCount,
        words: questions.length,
        mistakes: totalMistakes,
        accuracy,
        seconds,
        date: new Date().toLocaleString('ja-JP'),
      }
      setRecords(saveDictRecord(record))
      setResult(record)
      setFinished(true)
    },
    [level, theme, questions.length],
  )

  const select = useCallback(
    (i) => {
      if (stage !== 'select' || finished) return
      if (startTimeRef.current === null) startTimeRef.current = performance.now()
      setPicked(i)
      if (q.options[i].answer) setCorrect((c) => c + 1)
      setStage('type') // 正解の定義を入力するフェーズへ
    },
    [stage, finished, q],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      if (finished) {
        if (e.key === 'Enter') {
          e.preventDefault()
          restart()
        }
        return
      }
      if (stage === 'select') {
        const n = Number(e.key)
        if (n >= 1 && n <= q.options.length) {
          e.preventDefault()
          select(n - 1)
        }
        return
      }
      // type フェーズ：正解の定義を打つ
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const candidate = input + e.key
      if (segMatches(seg, candidate)) {
        setHasError(false)
        const newKeys = typedKeys + 1
        setTypedKeys(newKeys)
        if (seg.variants.includes(candidate)) {
          if (index >= questions.length - 1) {
            finish(newKeys, mistakes, correct, performance.now())
          } else {
            setIndex((i) => i + 1)
            setStage('select')
            setPicked(null)
            setInput('')
          }
        } else {
          setInput(candidate)
        }
      } else {
        setMistakes((m) => m + 1)
        setHasError(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, stage, q, seg, index, questions.length, input, typedKeys, mistakes, correct, select, restart, onExit, finish])

  return {
    question: q,
    index,
    stage,
    picked,
    input,
    hasError,
    typedKeys,
    mistakes,
    correct,
    liveSpeed,
    elapsedSec,
    total: questions.length,
    finished,
    result,
    records,
    select,
    restart,
  }
}
