// #451 記録の1件削除：キー→記録配列のマップから 1 件消した新しいマップを返す純関数の仕様。
// applySave*（memoryStore.policy）と同じ「非破壊・新参照を返す」規約に従う削除側の相棒。
// index は 0 始まり（UI の position は 1 始まりだが、その変換はファサード側の責務）。
import { describe, it, expect } from 'vitest'
import { applyDeleteAt, applySaveRecord } from './memoryStore.policy.js'
import { recKey } from '../../domain/records/ranking.service.js'

// 入力マップを変更していないこと（非破壊）を確かめる補助。
const snapshotOf = (map) => JSON.parse(JSON.stringify(map))

describe('applyDeleteAt（該当キーの配列から index の 1 件を消す）', () => {
  it('index 0 始まりで指定した1件だけを消す', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }, { keys: 10 }] }
    expect(applyDeleteAt(map, 'k', 1)).toEqual({ k: [{ keys: 30 }, { keys: 10 }] })
  })

  it('先頭（index 0）を消せる', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', 0)).toEqual({ k: [{ keys: 20 }] })
  })

  it('末尾（index length-1）を消せる', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', 1)).toEqual({ k: [{ keys: 30 }] })
  })

  it('残った要素の順序が保たれる（ランキング順を崩さない）', () => {
    const map = { k: [{ keys: 50 }, { keys: 40 }, { keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', 1).k).toEqual([{ keys: 50 }, { keys: 30 }, { keys: 20 }])
  })

  it('他のキーは触らず、同じ参照のまま持ち越す', () => {
    const other = [{ keys: 99 }]
    const map = { k: [{ keys: 30 }, { keys: 20 }], other }
    const after = applyDeleteAt(map, 'k', 0)
    expect(after.other).toBe(other)
  })
})

describe('applyDeleteAt の空キー掃除（空配列を残さない）', () => {
  it('最後の1件を消したらキーごと消える', () => {
    const map = { k: [{ keys: 30 }] }
    const after = applyDeleteAt(map, 'k', 0)
    expect(after).toEqual({})
    expect('k' in after).toBe(false) // 空配列を残さない（キー自体が消える）
  })

  it('空になったキー以外は残る', () => {
    const map = { k: [{ keys: 30 }], other: [{ keys: 99 }] }
    const after = applyDeleteAt(map, 'k', 0)
    expect(after).toEqual({ other: [{ keys: 99 }] })
  })
})

describe('applyDeleteAt の非破壊性（applySave* と同じ規約）', () => {
  it('入力マップと配列を変更しない（元配列の length が変わらない）', () => {
    const list = [{ keys: 30 }, { keys: 20 }, { keys: 10 }]
    const map = { k: list }
    const snapshot = snapshotOf(map)
    applyDeleteAt(map, 'k', 1)
    expect(list).toHaveLength(3)
    expect(map).toEqual(snapshot)
  })

  it('新しいトップレベル参照を返す（マップを共有しない）', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', 0)).not.toBe(map)
  })

  it('更新したキーの配列も新しい参照になる', () => {
    const list = [{ keys: 30 }, { keys: 20 }]
    const map = { k: list }
    expect(applyDeleteAt(map, 'k', 0).k).not.toBe(list)
  })
})

describe('applyDeleteAt の全域性（無効な指定では何も起きない）', () => {
  it('index が範囲外（length 以上）なら元と同値のマップを返す', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', 2)).toEqual(map)
    expect(applyDeleteAt(map, 'k', 99)).toEqual(map)
  })

  it('index が負なら元と同値のマップを返す（末尾から数えない）', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', -1)).toEqual(map)
  })

  it('index が整数でない（小数・NaN・undefined・文字列）なら元と同値のマップを返す', () => {
    const map = { k: [{ keys: 30 }, { keys: 20 }] }
    expect(applyDeleteAt(map, 'k', 0.5)).toEqual(map)
    expect(applyDeleteAt(map, 'k', NaN)).toEqual(map)
    expect(applyDeleteAt(map, 'k', undefined)).toEqual(map)
    expect(applyDeleteAt(map, 'k', '0')).toEqual(map)
  })

  it('存在しないキーなら元と同値のマップを返す（キーを新設しない）', () => {
    const map = { k: [{ keys: 30 }] }
    const after = applyDeleteAt(map, 'missing', 0)
    expect(after).toEqual(map)
    expect('missing' in after).toBe(false)
  })

  it('値が配列でないキーは触らない（元と同値のマップを返す）', () => {
    const map = { k: { keys: 30 } }
    expect(applyDeleteAt(map, 'k', 0)).toEqual(map)
  })

  it('map が null/undefined でも throw せず空マップを返す', () => {
    expect(applyDeleteAt(null, 'k', 0)).toEqual({})
    expect(applyDeleteAt(undefined, 'k', 0)).toEqual({})
  })

  it('key が null/undefined でも throw せず元と同値のマップを返す', () => {
    const map = { k: [{ keys: 30 }] }
    expect(applyDeleteAt(map, null, 0)).toEqual(map)
    expect(applyDeleteAt(map, undefined, 0)).toEqual(map)
  })
})

describe('applyDeleteAt と applySaveRecord の往復（保存→削除で元に戻る）', () => {
  it('保存した1件を同じキーの index で消すと保存前の像に戻る', () => {
    const key = recKey('both', 1)
    const base = applySaveRecord({}, { mode: 'both', rank: 1, keys: 100, mistakes: 0 })
    const added = applySaveRecord(base, { mode: 'both', rank: 1, keys: 50, mistakes: 2 })
    expect(added[key]).toHaveLength(2)
    // keys 降順なので後から入れた 50 は index 1
    expect(applyDeleteAt(added, key, 1)).toEqual(base)
  })

  it('唯一の記録を消すとキーごと消えて空像に戻る', () => {
    const key = recKey('both', 1)
    const one = applySaveRecord({}, { mode: 'both', rank: 1, keys: 100, mistakes: 0 })
    expect(applyDeleteAt(one, key, 0)).toEqual({})
  })
})
