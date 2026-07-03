import { describe, it, expect } from 'vitest'
import {
  rankInsert,
  recKey,
  MAX_RECORDS,
  endConditionToken,
  isRecordable,
  compareRecords,
} from './ranking.js'

const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0)

describe('ranking', () => {
  it('recKey は mode と rank を合成する', () => {
    expect(recKey('both', 3)).toBe('both__r3')
  })

  it('recKey は source 別・theme 別にキーを分ける（テーマ未指定は据え置き）', () => {
    expect(recKey('both', 1, 'wsent')).toBe('both__wsent1')
    expect(recKey('both', 1, 'wsent', 'すべて')).toBe('both__wsent1__すべて')
    expect(recKey('both', 1, 'wsent', '日常')).toBe('both__wsent1__日常')
    // テーマ違いは別キー＝別ランキング
    expect(recKey('both', 1, 'wsent', '旅行')).not.toBe(recKey('both', 1, 'wsent', 'すべて'))
    // タッチ等（theme 無し）はキー据え置きで後方互換
    expect(recKey('home', 1, 'touch')).toBe('home__touch1')
  })

  it('タイピング数(keys)の多い順に並べ、最大件数で切る', () => {
    const list = rankInsert([{ keys: 300 }, { keys: 500 }], { keys: 400 })
    expect(list.map((r) => r.keys)).toEqual([500, 400, 300])
  })

  it('keys 同数はミスの少ない順', () => {
    const list = rankInsert([{ keys: 400, mistakes: 5 }], { keys: 400, mistakes: 2 })
    expect(list.map((r) => r.mistakes)).toEqual([2, 5])
  })

  it('keys が無い古い記録は 0 扱いで末尾に回る', () => {
    const list = rankInsert([{ keys: 100 }], { speed: 999 })
    expect(list[0].keys).toBe(100)
    expect(list[1].keys).toBeUndefined()
  })

  it('MAX_RECORDS を超えない', () => {
    let list = []
    for (let i = 0; i < MAX_RECORDS + 10; i++) list = rankInsert(list, { keys: i })
    expect(list.length).toBe(MAX_RECORDS)
    expect(list[0].keys).toBe(MAX_RECORDS + 9) // 最多が先頭
  })
})

describe('endConditionToken（#208 段0b）', () => {
  it('null / undefined は空文字（既定 time60 の従来キーへ落とす）', () => {
    expect(endConditionToken(null)).toBe('')
    expect(endConditionToken(undefined)).toBe('')
  })

  it('既定の time60 は空文字（従来キーと同一＝後方互換）', () => {
    expect(endConditionToken({ kind: 'time', value: 60 })).toBe('')
  })

  it('time60 と null/undefined は同じトークンになる（既存記録の後方互換）', () => {
    expect(endConditionToken({ kind: 'time', value: 60 })).toBe(endConditionToken(null))
    expect(endConditionToken({ kind: 'time', value: 60 })).toBe(endConditionToken(undefined))
  })

  it('time30 は T30', () => {
    expect(endConditionToken({ kind: 'time', value: 30 })).toBe('T30')
  })

  it('chars600 は C600', () => {
    expect(endConditionToken({ kind: 'chars', value: 600 })).toBe('C600')
  })

  it('items25 は I25', () => {
    expect(endConditionToken({ kind: 'items', value: 25 })).toBe('I25')
  })

  it('life3 は L3', () => {
    expect(endConditionToken({ kind: 'life', value: 3 })).toBe('L3')
  })

  it('endless は空文字（非記録・キー生成に使わない）', () => {
    expect(endConditionToken({ kind: 'endless', value: null })).toBe('')
  })
})

describe('isRecordable（#208 段0b）', () => {
  it('endless のみ記録対象外', () => {
    expect(isRecordable({ kind: 'endless', value: null })).toBe(false)
  })

  it('time / chars / items / life は記録対象', () => {
    expect(isRecordable({ kind: 'time', value: 60 })).toBe(true)
    expect(isRecordable({ kind: 'time', value: 30 })).toBe(true)
    expect(isRecordable({ kind: 'chars', value: 600 })).toBe(true)
    expect(isRecordable({ kind: 'items', value: 25 })).toBe(true)
    expect(isRecordable({ kind: 'life', value: 3 })).toBe(true)
  })

  it('null / undefined は既定 time60 扱いで記録対象', () => {
    expect(isRecordable(null)).toBe(true)
    expect(isRecordable(undefined)).toBe(true)
  })
})

describe('compareRecords（#208 段0b・Array.sort 準拠）', () => {
  it('null（=time60）は keys 降順（多い方が上位＝負）', () => {
    expect(sign(compareRecords(null, { keys: 50, mistakes: 2 }, { keys: 30, mistakes: 0 }))).toBe(-1)
  })

  it('time60 同点は mistakes 昇順（少ない方が上位）', () => {
    const ec = { kind: 'time', value: 60 }
    expect(sign(compareRecords(ec, { keys: 20, mistakes: 1 }, { keys: 20, mistakes: 5 }))).toBe(-1)
  })

  it('chars600 は seconds 昇順（速い方が上位）', () => {
    const ec = { kind: 'chars', value: 600 }
    expect(sign(compareRecords(ec, { seconds: 42, mistakes: 3 }, { seconds: 55.5, mistakes: 0 }))).toBe(-1)
  })

  it('chars600 同秒は mistakes 昇順（少ない方が上位）', () => {
    const ec = { kind: 'chars', value: 600 }
    expect(sign(compareRecords(ec, { seconds: 40, mistakes: 2 }, { seconds: 40, mistakes: 0 }))).toBe(1)
  })

  it('items25 は correctCount 降順（正解数の多い方が上位）', () => {
    const ec = { kind: 'items', value: 25 }
    expect(sign(compareRecords(ec, { correctCount: 20, seconds: 80 }, { correctCount: 23, seconds: 90 }))).toBe(1)
  })

  it('items25 同数は seconds 昇順（速い方が上位）', () => {
    const ec = { kind: 'items', value: 25 }
    expect(sign(compareRecords(ec, { correctCount: 23, seconds: 70 }, { correctCount: 23, seconds: 90 }))).toBe(-1)
  })

  it('life3 は correctCount 優先（時間が長くても正解数が多い方が上位）', () => {
    const ec = { kind: 'life', value: 3 }
    expect(sign(compareRecords(ec, { correctCount: 15, seconds: 120 }, { correctCount: 8, seconds: 60 }))).toBe(-1)
  })

  it('endless は非記録＝常に 0（同着扱い）', () => {
    const ec = { kind: 'endless', value: null }
    expect(compareRecords(ec, { keys: 100 }, { keys: 1 })).toBe(0)
    expect(compareRecords(ec, { correctCount: 9, seconds: 10 }, { correctCount: 1, seconds: 99 })).toBe(0)
  })

  it('items 欠損（correctCount 無しの旧レコード）は 0 扱いで最下位', () => {
    const ec = { kind: 'items', value: 25 }
    expect(sign(compareRecords(ec, { seconds: 70 }, { correctCount: 1, seconds: 90 }))).toBe(1)
  })

  it('入力オブジェクトを破壊しない', () => {
    const ec = { kind: 'items', value: 25 }
    const a = { correctCount: 20, seconds: 80 }
    const b = { correctCount: 23, seconds: 90 }
    compareRecords(ec, a, b)
    expect(a).toEqual({ correctCount: 20, seconds: 80 })
    expect(b).toEqual({ correctCount: 23, seconds: 90 })
  })

  it('反対称性：time で sign(cmp(a,b)) === -sign(cmp(b,a))', () => {
    const ec = { kind: 'time', value: 60 }
    const a = { keys: 50, mistakes: 2 }
    const b = { keys: 30, mistakes: 0 }
    expect(sign(compareRecords(ec, a, b))).toBe(-sign(compareRecords(ec, b, a)))
  })

  it('反対称性：chars で sign(cmp(a,b)) === -sign(cmp(b,a))', () => {
    const ec = { kind: 'chars', value: 600 }
    const a = { seconds: 42, mistakes: 3 }
    const b = { seconds: 55.5, mistakes: 0 }
    expect(sign(compareRecords(ec, a, b))).toBe(-sign(compareRecords(ec, b, a)))
  })

  it('反対称性：items で sign(cmp(a,b)) === -sign(cmp(b,a))', () => {
    const ec = { kind: 'items', value: 25 }
    const a = { correctCount: 20, seconds: 80 }
    const b = { correctCount: 23, seconds: 90 }
    expect(sign(compareRecords(ec, a, b))).toBe(-sign(compareRecords(ec, b, a)))
  })

  it('未知 kind は time と同じ挙動へフォールバック（keys 降順→mistakes 昇順）', () => {
    const ec = { kind: 'mystery', value: 1 }
    expect(sign(compareRecords(ec, { keys: 50, mistakes: 2 }, { keys: 30, mistakes: 0 }))).toBe(-1)
    expect(sign(compareRecords(ec, { keys: 20, mistakes: 1 }, { keys: 20, mistakes: 5 }))).toBe(-1)
  })
})
