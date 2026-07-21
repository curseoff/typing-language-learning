// @vitest-environment jsdom
// #451 記録を1件削除したとき、下敷きの結果ページのランキングが古いまま残らないこと。
// 各プレイのフックは自前の records state を持つので、application のメモリ像だけを書き換える
// 削除では取り残される。useRecordsSync（変更通知の購読）で追随することを結合で確認する。
// 実 records.service（initMemoryPersistence + 実際の save）で組み、削除も実 deleteRecordAt を使う。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { useDict } from './useDict.js'
import {
  initMemoryPersistence,
  saveWordRecord,
  saveDictRecord,
  deleteRecordAt,
  loadWordRecords,
  loadDictRecords,
  wordRecKey,
  dictRecKey,
} from './records.service.js'
import { WORDS } from '../content/wordsAll.js'
import { DICT } from '../content/dictionaryAll.js'

const WORD_KEY = wordRecKey(1, 'すべて', 'en')
const DICT_KEY = dictRecKey(1, 'すべて', 'ja')

const wordRec = (keys, date) => ({ source: 'word', level: 1, theme: 'すべて', mode: 'en', keys, date })
const dictRec = (keys, date) => ({ source: 'dict', level: 1, theme: 'すべて', mode: 'ja', keys, date })

beforeEach(() => {
  initMemoryPersistence()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('記録削除への追随（フックの records state）', () => {
  it('useWords: 削除すると自分の records から消える', () => {
    saveWordRecord(wordRec(300, '2026-07-01'))
    saveWordRecord(wordRec(100, '2026-07-02'))
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    expect(result.current.records[WORD_KEY].map((r) => r.keys)).toEqual([300, 100])

    // 2位（keys=100）を消す。位置は UI と同じ 1 始まり。
    act(() => {
      expect(deleteRecordAt(loadWordRecords()[WORD_KEY][1], 2)).toBe(true)
    })
    expect(result.current.records[WORD_KEY].map((r) => r.keys)).toEqual([300])
  }, 20000)

  it('useDict: 削除すると自分の records から消える', () => {
    saveDictRecord(dictRec(300, '2026-07-01'))
    saveDictRecord(dictRec(100, '2026-07-02'))
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    expect(result.current.records[DICT_KEY].map((r) => r.keys)).toEqual([300, 100])

    act(() => {
      expect(deleteRecordAt(loadDictRecords()[DICT_KEY][0], 1)).toBe(true)
    })
    expect(result.current.records[DICT_KEY].map((r) => r.keys)).toEqual([100])
  }, 20000)

  it('最後の1件を消すとキーごと落ちる（空のランキングを描画しない）', () => {
    saveWordRecord(wordRec(300, '2026-07-01'))
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    act(() => {
      deleteRecordAt(loadWordRecords()[WORD_KEY][0], 1)
    })
    expect(result.current.records[WORD_KEY]).toBeUndefined()
  }, 20000)

  it('unmount 後に削除が起きても setState されない（購読が解除されている）', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    saveWordRecord(wordRec(300, '2026-07-01'))
    saveWordRecord(wordRec(100, '2026-07-02'))
    const { unmount } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    unmount()
    act(() => {
      expect(deleteRecordAt(loadWordRecords()[WORD_KEY][1], 2)).toBe(true)
    })
    expect(error).not.toHaveBeenCalled()
  }, 20000)
})
