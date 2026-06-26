// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  itemStatId,
  storyStatId,
  wordRanking,
  dictRanking,
  loadStoryRecords,
  loadItemStats,
} from './records.js'

describe('application/records（記録ファサード）', () => {
  beforeEach(() => localStorage.clear())

  it('itemStatId は type を記録上の接頭辞に変換する', () => {
    expect(itemStatId('dict', 'en', 'hotel')).toBe('d:en:hotel')
    expect(itemStatId('marathon', 'both', 'I go.')).toBe('s:both:I go.')
    expect(itemStatId('words', 'en', 'reserve')).toBe('w:en:reserve')
  })

  it('storyStatId は story:mode:nodeId 形式', () => {
    expect(storyStatId('ja', 'start')).toBe('story:ja:start')
  })

  it('wordRanking は保存済みランキングを条件キーで引く', () => {
    localStorage.setItem(
      'word-records-v2',
      JSON.stringify({ 'L1__すべて__quiz-en': [{ correct: 5, words: 30 }] }),
    )
    expect(wordRanking(1, 'すべて', 'quiz-en')).toEqual([{ correct: 5, words: 30 }])
    expect(wordRanking(2, 'すべて', 'quiz-en')).toBeUndefined()
  })

  it('dictRanking は保存済みランキングを条件キーで引く', () => {
    localStorage.setItem(
      'dict-records-v1',
      JSON.stringify({ 'L1__すべて__quiz': [{ correct: 10, words: 20 }] }),
    )
    expect(dictRanking(1, 'すべて', 'quiz')).toEqual([{ correct: 10, words: 20 }])
    expect(dictRanking(9, 'すべて', 'quiz')).toBeUndefined()
  })

  it('未保存時は空を返す（read のファサードが落ちない）', () => {
    expect(loadStoryRecords()).toEqual([])
    expect(loadItemStats()).toEqual({})
  })
})
