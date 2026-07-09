import { describe, it, expect, vi, beforeEach } from 'vitest'
// #273 Phase3b: ファサードの多タブ協調（主/副ロール・read-only・snapshot 差し替え・handoff 昇格）の
// 配線テスト。純ロジック（election/secondaryMessage）は各 spec が担保済み。ここは「副タブは
// メモリ像を楽観更新するが Worker write-through も change broadcast もしない／snapshot で像が
// 置換される／昇格で書込みが解禁される」という records.js の状態機械の配線を確認する。
import {
  initSqlitePersistence,
  initSecondaryPersistence,
  promoteToPrimary,
  replaceImage,
  getPersistRole,
  getPersistImage,
  getPersistEpoch,
  consumeSecondaryWriteAttempt,
  loadWordRecords,
  saveWordRecord,
  loadRecords,
  saveRecord,
  loadFound,
} from './records.js'
import { wordRecKey } from '../domain/records/recordKeys.js'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('主タブ（primary）', () => {
  it('initSqlitePersistence で role=primary・save は write-through し change を broadcast する', async () => {
    const save = vi.fn(() => Promise.resolve())
    const onChange = vi.fn()
    initSqlitePersistence({ save }, {}, { epoch: 2, onChange })
    expect(getPersistRole()).toBe('primary')
    expect(getPersistEpoch()).toBe(2)

    const record = { level: 1, theme: 'すべて', mode: 'en', keys: 10, mistakes: 0 }
    const out = saveWordRecord(record)
    expect(out[wordRecKey(1, 'すべて', 'en')]).toHaveLength(1)
    // change broadcast は現在の epoch を載せて即時に呼ばれる。
    expect(onChange).toHaveBeenCalledWith(2)
    await tick()
    expect(save).toHaveBeenCalledWith('word', [record])
  })
})

describe('副タブ（secondary・read-only）', () => {
  beforeEach(() => {
    // 主から受領した snapshot でメモリ像をセット（read-only）。
    initSecondaryPersistence({ wordRecords: {}, records: {} }, { epoch: 3 })
  })

  it('role=secondary・epoch は snapshot の値', () => {
    expect(getPersistRole()).toBe('secondary')
    expect(getPersistEpoch()).toBe(3)
  })

  it('save はメモリ像を楽観更新して返すが Worker 書込みも change 通知もしない', () => {
    const record = { mode: 'both', rank: 1, keys: 20, mistakes: 0 }
    const out = saveRecord(record)
    // 当該タブ表示用にメモリ像は更新される（楽観）。
    expect(Object.keys(out).length).toBe(1)
    expect(loadRecords()).toBe(out)
    // 保存要求が起きたフラグが立ち、消費すると false に戻る（UI の控えめ告知用）。
    expect(consumeSecondaryWriteAttempt()).toBe(true)
    expect(consumeSecondaryWriteAttempt()).toBe(false)
  })

  it('replaceImage で新しい snapshot に丸ごと差し替え epoch も更新する', () => {
    // 副が古い像を持っていても、主から届いた新 snapshot で置換される（主の真実に追従）。
    saveWordRecord({ level: 1, theme: 'すべて', mode: 'en', keys: 5, mistakes: 0 })
    const fresh = {
      wordRecords: { [wordRecKey(2, 'すべて', 'ja')]: [{ level: 2, keys: 99 }] },
      storyFound: { travel: ['a', 'b'] },
    }
    replaceImage(fresh, 7)
    expect(getPersistEpoch()).toBe(7)
    expect(loadWordRecords()[wordRecKey(2, 'すべて', 'ja')]).toHaveLength(1)
    expect(loadWordRecords()[wordRecKey(1, 'すべて', 'en')]).toBeUndefined() // 楽観更新は破棄
    expect(loadFound('travel')).toEqual(['a', 'b'])
  })

  it('getPersistImage は主が snapshot 応答に載せる現在のメモリ像を返す', () => {
    expect(getPersistImage()).toMatchObject({ wordRecords: {}, records: {} })
  })
})

describe('handoff 昇格（secondary → primary）', () => {
  it('promoteToPrimary で role=primary になり、新 handle へ write-through が解禁される（ガード①）', async () => {
    initSecondaryPersistence({ records: {} }, { epoch: 4 })
    expect(getPersistRole()).toBe('secondary')

    const save = vi.fn(() => Promise.resolve())
    const onChange = vi.fn()
    // 主が閉じ、OPFS を開き直して再 hydrate した像で昇格する。
    promoteToPrimary({ save }, { records: {} }, { epoch: 5, onChange })
    expect(getPersistRole()).toBe('primary')
    expect(getPersistEpoch()).toBe(5)

    const record = { mode: 'both', rank: 1, keys: 30, mistakes: 0 }
    saveRecord(record)
    expect(onChange).toHaveBeenCalledWith(5)
    await tick()
    expect(save).toHaveBeenCalledWith('records', [record])
  })
})
