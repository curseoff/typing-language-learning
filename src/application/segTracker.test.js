import { describe, it, expect } from 'vitest'
import { newSegTracker, segMark, segMiss, segPush, segMissedItems } from './segTracker.policy.js'

describe('segTracker（問題ごとの記録）', () => {
  it('セグメント完了で1件積み、type/label/keys/ミス/秒/速度を持つ', () => {
    const tr = newSegTracker()
    segMark(tr, 1000) // 最初の打鍵
    segMiss(tr)
    segMiss(tr)
    segPush(tr, { type: 'en', label: 'good', keys: 4, t: 1000 + 60000 }) // 60秒で4打
    expect(tr.list).toHaveLength(1)
    const s = tr.list[0]
    expect(s.no).toBe(1)
    expect(s.type).toBe('en')
    expect(s.label).toBe('good')
    expect(s.keys).toBe(4)
    expect(s.mistakes).toBe(2)
    expect(s.seconds).toBe(60)
    expect(s.speed).toBe(4) // 4打 / 1分
    expect(s.partial).toBe(false)
  })

  it('segMark は最初の打鍵時刻のみ採用し、push 後はミス/開始がリセットされる', () => {
    const tr = newSegTracker()
    segMark(tr, 500)
    segMark(tr, 900) // 無視される（既に開始済み）
    expect(tr.start).toBe(500)
    segPush(tr, { type: 'ja', label: '良い', keys: 3, t: 500 + 30000, partial: true })
    expect(tr.start).toBeNull()
    expect(tr.mistakes).toBe(0)
    expect(tr.list[0].partial).toBe(true)
    // 2件目は連番
    segMark(tr, 100000)
    segPush(tr, { type: 'en', label: 'next', keys: 4, t: 100000 + 12000 })
    expect(tr.list[1].no).toBe(2)
  })

  it('segMark 前に segPush すると seconds も speed も 0 になる（開始未記録＝ms 0）', () => {
    const tr = newSegTracker()
    // segMark を呼ばないので tr.start は null のまま
    segPush(tr, { type: 'ja', label: '未打鍵', keys: 5, t: 12345 })
    const s = tr.list[0]
    expect(s.seconds).toBe(0)
    expect(s.speed).toBe(0) // ms が 0 なので速度算出は 0 分岐
  })

  it('sentenceIndex を渡すと記録に何文目かが残る', () => {
    const tr = newSegTracker()
    segMark(tr, 0)
    segPush(tr, { type: 'en', label: 'both', keys: 3, t: 6000, sentenceIndex: 2 })
    expect(tr.list[0].sentenceIndex).toBe(2)
  })

  it('sentenceIndex を渡さなければキー自体が付かない', () => {
    const tr = newSegTracker()
    segMark(tr, 0)
    segPush(tr, { type: 'en', label: 'both', keys: 3, t: 6000 })
    expect('sentenceIndex' in tr.list[0]).toBe(false)
  })

  it('en/ja/kana を渡すと透過保存し、渡さなければキー自体が付かない（#240）', () => {
    const tr = newSegTracker()
    segMark(tr, 0)
    segPush(tr, { type: 'en', label: 'good', keys: 4, t: 6000, en: 'good', ja: '良い', kana: 'よい' })
    expect(tr.list[0].en).toBe('good')
    expect(tr.list[0].ja).toBe('良い')
    expect(tr.list[0].kana).toBe('よい')
    // 未指定ならキー自体が付かない（旧形状を維持）
    segMark(tr, 8000)
    segPush(tr, { type: 'ja', label: 'x', keys: 1, t: 9000 })
    expect('en' in tr.list[1]).toBe(false)
    expect('ja' in tr.list[1]).toBe(false)
    expect('kana' in tr.list[1]).toBe(false)
  })
})

describe('segMissedItems（ライフ制のミスした問題数・#208 段5）', () => {
  it('確定なし・進行中ミス0 なら 0', () => {
    const tr = newSegTracker()
    expect(segMissedItems(tr)).toBe(0)
  })

  it('確定済みでミス>0 の件数を数える（ミス0の確定は数えない）', () => {
    const tr = newSegTracker()
    // ミスありの確定
    segMark(tr, 0)
    segMiss(tr)
    segPush(tr, { type: 'ja', label: 'a', keys: 2, t: 1000 })
    // ミス0の確定
    segMark(tr, 2000)
    segPush(tr, { type: 'ja', label: 'b', keys: 2, t: 3000 })
    // ミスありの確定
    segMark(tr, 4000)
    segMiss(tr)
    segMiss(tr)
    segPush(tr, { type: 'ja', label: 'c', keys: 2, t: 5000 })
    expect(segMissedItems(tr)).toBe(2)
  })

  it('進行中の問題が既にミス済みなら +1 する（確定なし）', () => {
    const tr = newSegTracker()
    segMark(tr, 0)
    segMiss(tr) // まだ push していない進行中の問題でミス
    expect(segMissedItems(tr)).toBe(1)
  })

  it('確定のミス件数＋進行中ミスの両方を合算する', () => {
    const tr = newSegTracker()
    segMark(tr, 0)
    segMiss(tr)
    segPush(tr, { type: 'ja', label: 'a', keys: 2, t: 1000 }) // 確定ミス1件
    segMark(tr, 2000)
    segMiss(tr) // 進行中でミス
    expect(segMissedItems(tr)).toBe(2)
  })

  it('確定レコードの mistakes が欠損しても 0 扱いで数えない（?? 0 の右辺分岐）', () => {
    const tr = newSegTracker()
    // mistakes フィールドの無い古い/手組みレコードを直接注入
    tr.list.push({ no: 1, type: 'ja', label: 'x', keys: 1 })
    expect(segMissedItems(tr)).toBe(0)
  })
})
