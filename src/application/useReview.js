// 復習(SRS)セッションの状態機械。和訳(ja)を見て英単語(en)をタイプ＝産出想起。
// ミスなく打てれば正解→box上げ／ミス or 答えを見る→box1に戻す。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { review, buildQueue } from '../domain/srs/srs.js'
import {
  loadSrs,
  saveCard,
  todayNum,
  newIntroducedToday,
  addIntroduced,
} from '../infrastructure/srsRepository.js'

const NEW_PER_DAY = 10
const REVIEW_LIMIT = 60
const shuffle = (a) => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export function useReview({ words, onExit }) {
  // セッション開始時にデッキを確定（頻度順で新規を導入、復習はシャッフル）
  const deck = useMemo(() => {
    const byEn = new Map(words.map((w) => [w.en, w]))
    const ids = [...words].sort((a, b) => (a.freq ?? 1e9) - (b.freq ?? 1e9)).map((w) => w.en)
    const srs = loadSrs()
    const today = todayNum()
    const remainingNew = Math.max(0, NEW_PER_DAY - newIntroducedToday())
    const { reviews, news } = buildQueue(ids, srs, today, {
      newLimit: remainingNew,
      reviewLimit: REVIEW_LIMIT,
    })
    return [
      ...shuffle(reviews).map((id) => ({ ...byEn.get(id), isNew: false })),
      ...news.map((id) => ({ ...byEn.get(id), isNew: true })),
    ]
  }, [words])

  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [mistakes, setMistakes] = useState(0)
  const [revealed, setRevealed] = useState(false) // 答え表示中（要 Enter で次へ）
  const [correct, setCorrect] = useState(0)
  const erroredRef = useRef(false)

  const card = deck[index]
  const finished = index >= deck.length
  const target = card?.en ?? ''

  // SRS を更新して次のカードへ
  const grade = useCallback(
    (ok) => {
      if (!card) return
      const today = todayNum()
      const prev = loadSrs()[card.en]
      saveCard(card.en, review(prev, ok, today))
      if (!prev && card.isNew) addIntroduced(1)
      if (ok) setCorrect((c) => c + 1)
    },
    [card],
  )

  const next = useCallback(() => {
    setIndex((i) => i + 1)
    setInput('')
    setRevealed(false)
    erroredRef.current = false
  }, [])

  const reveal = useCallback(() => {
    if (finished || revealed) return
    grade(false)
    setRevealed(true) // 答えを見せ、Enter で次へ
  }, [finished, revealed, grade])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      if (finished) return
      if (revealed) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          next()
        }
        return
      }
      if (e.key === 'Tab') {
        // 答えを見る
        e.preventDefault()
        reveal()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setInput((p) => p.slice(0, -1))
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const cand = input + e.key
      if (target.startsWith(cand)) {
        setInput(cand)
        if (cand === target) {
          grade(!erroredRef.current) // ミス無しなら正解
          next()
        }
      } else {
        setMistakes((m) => m + 1)
        erroredRef.current = true
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [input, target, finished, revealed, grade, next, reveal, onExit])

  return {
    card,
    finished,
    revealed,
    input,
    mistakes,
    index,
    total: deck.length,
    correct,
    reveal,
  }
}
