// 復習(SRS)セッションの状態機械。デッキ(単語/英英/単語例文)ごとに手がかりは違うが、
// いずれも英単語をタイプ＝産出想起。ミスなく打てれば正解→box上げ／ミス or 答えを見る→box1。
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

export function useReview({ deck, items, onExit }) {
  // セッション開始時にデッキを確定（新規は order 順、復習はシャッフル）
  const cardsDeck = useMemo(() => {
    const ordered = deck.order(items)
    const byId = new Map()
    const ids = []
    for (const it of ordered) {
      const id = deck.id(it)
      if (byId.has(id)) continue // 同一語の重複（例文）は最初の1件
      byId.set(id, it)
      ids.push(id)
    }
    const srs = loadSrs()
    const today = todayNum()
    const remainingNew = Math.max(0, NEW_PER_DAY - newIntroducedToday())
    const { reviews, news } = buildQueue(ids, srs, today, {
      newLimit: remainingNew,
      reviewLimit: REVIEW_LIMIT,
    })
    const toCard = (id, isNew) => {
      const it = byId.get(id)
      return { id, prompt: deck.prompt(it), answer: deck.answer(it), isNew }
    }
    return [...shuffle(reviews).map((id) => toCard(id, false)), ...news.map((id) => toCard(id, true))]
  }, [deck, items])

  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [mistakes, setMistakes] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const erroredRef = useRef(false)

  const card = cardsDeck[index]
  const finished = index >= cardsDeck.length
  const target = card?.answer ?? ''

  const grade = useCallback(
    (ok) => {
      if (!card) return
      const today = todayNum()
      const prev = loadSrs()[card.id]
      saveCard(card.id, review(prev, ok, today))
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
    setRevealed(true)
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
          grade(!erroredRef.current)
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
    total: cardsDeck.length,
    correct,
    reveal,
  }
}
