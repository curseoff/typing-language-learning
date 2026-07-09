// 記録の識別キー生成（純粋）の単体テスト。#274 で localStorage リポジトリから分離した
// wordRecKey/dictRecKey/storyRecKey/itemId を被覆する（各 repo テストのキー生成ケースを移植）。
import { describe, it, expect } from 'vitest'
import { wordRecKey, dictRecKey, storyRecKey, itemId } from './recordKeys.js'

describe('wordRecKey', () => {
  it('L{level}__{theme}__{mode} 形式（終了条件なし＝time60/未指定はタグ無し）', () => {
    expect(wordRecKey(3, 'ビジネス', 'quiz-en')).toBe('L3__ビジネス__quiz-en')
    expect(wordRecKey(1, 'すべて', 'en', { kind: 'time', value: 60 })).toBe('L1__すべて__en')
  })

  it('終了条件ありは末尾に __<tag> を付ける', () => {
    expect(wordRecKey(1, 'すべて', 'en', { kind: 'endless' })).toBe('L1__すべて__en__E')
    expect(wordRecKey(2, '旅行', 'en', { kind: 'items', value: 20 })).toBe('L2__旅行__en__I20')
  })
})

describe('dictRecKey', () => {
  it('L{level}__{theme}__{mode} 形式（終了条件なし）', () => {
    expect(dictRecKey(1, 'すべて', 'quiz')).toBe('L1__すべて__quiz')
  })

  it('終了条件ありは末尾に __<tag> を付ける', () => {
    expect(dictRecKey(3, 'ビジネス', 'ja', { kind: 'life', value: 3 })).toBe('L3__ビジネス__ja__L3')
  })
})

describe('storyRecKey', () => {
  it('story-records-v1-<id> 接頭辞（終了条件なし＝従来キーと一致）', () => {
    expect(storyRecKey('climbing')).toBe('story-records-v1-climbing')
    expect(storyRecKey('travel', { kind: 'time', value: 60 })).toBe('story-records-v1-travel')
  })

  it('終了条件ありは base と別キー（__<tag>）に分かれる', () => {
    const base = storyRecKey('climbing')
    const endless = storyRecKey('climbing', { kind: 'endless' })
    expect(endless).not.toBe(base)
    expect(endless).toBe('story-records-v1-climbing__E')
  })
})

describe('itemId', () => {
  it('type:mode:key 形式', () => {
    expect(itemId('w', 'en', 'reserve')).toBe('w:en:reserve')
    expect(itemId('d', 'ja', 'hotel')).toBe('d:ja:hotel')
  })

  it('key に : を含んでもそのまま連結する（文中コロン）', () => {
    expect(itemId('s', 'both', 'I go to school: today.')).toBe('s:both:I go to school: today.')
  })
})
