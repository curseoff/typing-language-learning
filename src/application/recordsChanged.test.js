// #451 記録の変更通知（subscribeRecordsChanged）。
// 削除は application のメモリ像だけを書き換えるので、自前の records state を持つ画面は
// 通知が無いと古いまま（消したのに残る）。ここでは通知の contract を固定する：
//   - 登録した listener に削除の成功時だけ届く／解除後は届かない
//   - 削除できなかった（false）ときは通知しない＝下敷きを無駄に再描画しない
//   - 保存では通知しない（保存は戻り値で state を更新済み＝二重更新にしない）
//   - listener の例外が他の購読者を巻き添えにしない
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initMemoryPersistence,
  subscribeRecordsChanged,
  deleteRecordAt,
  saveWordRecord,
  saveRecord,
  loadWordRecords,
} from './records.service.js'
import { recKey } from '../domain/records/ranking.service.js'
import { wordRecKey } from '../domain/records/recordKeys.service.js'

const REC_KEY = recKey('both', 1, 'sentence')
const WORD_KEY = wordRecKey(3, '日常', 'en')

const freshImage = () => ({
  records: [
    { mode: 'both', rank: 1, source: 'sentence', keys: 300, date: '2026-07-01' },
    { mode: 'both', rank: 1, source: 'sentence', keys: 200, date: '2026-07-02' },
  ],
  wordRecords: [
    { source: 'word', level: 3, theme: '日常', mode: 'en', keys: 90, date: '2026-07-01' },
    { source: 'word', level: 3, theme: '日常', mode: 'en', keys: 80, date: '2026-07-02' },
  ],
})

// 生の配列からテスト用の像を組む（配列は毎回複製＝テスト間で汚れない）。
const image = () => {
  const src = freshImage()
  return {
    records: { [REC_KEY]: src.records.map((r) => ({ ...r })) },
    wordRecords: { [WORD_KEY]: src.wordRecords.map((r) => ({ ...r })) },
  }
}

// 購読はモジュール内 Set に残るので、テストごとに必ず解除して独立性を保つ
// （init*Persistence は永続化バックエンドの切替であり、購読者のライフサイクルには触らない）。
let unsubs = []
const sub = (listener) => {
  const off = subscribeRecordsChanged(listener)
  unsubs.push(off)
  return off
}

beforeEach(() => {
  initMemoryPersistence(image())
})
afterEach(() => {
  unsubs.forEach((off) => off())
  unsubs = []
})

describe('subscribeRecordsChanged', () => {
  it('削除に成功したら購読者へ通知が届く', () => {
    const listener = vi.fn()
    sub(listener)
    expect(deleteRecordAt(loadWordRecords()[WORD_KEY][0], 1)).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('戻り値の解除関数を呼ぶと以後は届かない（unmount 後の setState を防ぐ）', () => {
    const listener = vi.fn()
    const unsubscribe = sub(listener)
    unsubscribe()
    deleteRecordAt(loadWordRecords()[WORD_KEY][0], 1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('複数の購読者すべてに届く（同時に開いている画面ぶん）', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = sub(a)
    sub(b)
    deleteRecordAt(loadWordRecords()[WORD_KEY][0], 1)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unsubA()
    deleteRecordAt(loadWordRecords()[WORD_KEY][0], 1)
    expect(a).toHaveBeenCalledTimes(1) // 解除済み
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('削除できなかった（false）ときは通知しない', () => {
    const listener = vi.fn()
    sub(listener)
    expect(deleteRecordAt(loadWordRecords()[WORD_KEY][0], 2)).toBe(false) // position ずれ
    expect(deleteRecordAt({}, 1)).toBe(false) // 座標が出せない
    expect(listener).not.toHaveBeenCalled()
  })

  it('保存では通知しない（保存は戻り値で state を更新済み＝二重更新にしない）', () => {
    const listener = vi.fn()
    sub(listener)
    saveWordRecord({ source: 'word', level: 3, theme: '日常', mode: 'en', keys: 95, date: '2026-07-04' })
    saveRecord({ mode: 'both', rank: 1, source: 'sentence', keys: 400, date: '2026-07-04' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('listener が投げても他の購読者に届き、削除自体は成功する', () => {
    const boom = vi.fn(() => {
      throw new Error('購読側の失敗')
    })
    const ok = vi.fn()
    sub(boom)
    sub(ok)
    expect(deleteRecordAt(loadWordRecords()[WORD_KEY][0], 1)).toBe(true)
    expect(ok).toHaveBeenCalledTimes(1)
    expect(loadWordRecords()[WORD_KEY]).toHaveLength(1)
  })
})
