// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  itemStatId,
  storyStatId,
  wordRanking,
  dictRanking,
  loadStoryRecords,
  loadItemStats,
  loadRecords,
  saveRecord,
  loadDictRecords,
  saveDictRecord,
  dictRecKey,
  loadWordRecords,
  saveWordRecord,
  wordRecKey,
  saveStoryRecord,
  saveFound,
  loadFound,
} from './records.js'
import { recKey } from '../domain/records/ranking.js'

describe('application/records（記録ファサード）', () => {
  beforeEach(() => localStorage.clear())

  it('itemStatId は type を記録上の接頭辞に変換する', () => {
    expect(itemStatId('dict', 'en', 'hotel')).toBe('d:en:hotel')
    expect(itemStatId('marathon', 'both', 'I go.')).toBe('s:both:I go.')
    expect(itemStatId('words', 'en', 'reserve')).toBe('w:en:reserve')
  })

  it('storyStatId は story:mode:storyId/nodeId 形式（物語別）', () => {
    expect(storyStatId('ja', 'travel', 'arrival')).toBe('story:ja:travel/arrival')
    expect(storyStatId('en', 'climbing', 'arrive')).toBe('story:en:climbing/arrive')
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
    expect(loadStoryRecords('travel')).toEqual([])
    expect(loadItemStats()).toEqual({})
  })

  it('saveRecord で保存した記録を loadRecords で読み戻せる（マラソン記録の窓口）', () => {
    expect(loadRecords()).toEqual({})
    const record = { mode: 'both', rank: 1, wpm: 50, accuracy: 100 }
    const all = saveRecord(record)
    const key = recKey(record.mode, record.rank, record.source)
    expect(all[key]).toContainEqual(expect.objectContaining({ wpm: 50 }))
    // 再エクスポートは infrastructure と同一実体なので読み戻せる
    expect(loadRecords()[key]).toContainEqual(expect.objectContaining({ wpm: 50 }))
  })

  it('saveDictRecord で保存した dict 記録を loadDictRecords で読み戻せる（facade 経由 round-trip）', () => {
    saveDictRecord({ level: 1, theme: 'すべて', mode: 'quiz', keys: 10 })
    expect(loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')]).toContainEqual(
      expect.objectContaining({ keys: 10 }),
    )
  })

  it('saveWordRecord で保存した word 記録を loadWordRecords で読み戻せる（facade 経由 round-trip）', () => {
    saveWordRecord({ level: 2, theme: 'すべて', mode: 'en', keys: 20 })
    expect(loadWordRecords()[wordRecKey(2, 'すべて', 'en')]).toContainEqual(
      expect.objectContaining({ keys: 20 }),
    )
  })

  it('saveFound/saveStoryRecord で保存した物語の記録を facade 経由で読み戻せる', () => {
    saveFound('travel', ['a'])
    expect(loadFound('travel')).toEqual(['a'])
    saveStoryRecord('travel', { keys: 5 })
    expect(loadStoryRecords('travel')).toContainEqual(expect.objectContaining({ keys: 5 }))
  })
})
