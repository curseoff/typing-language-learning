import { describe, it, expect } from 'vitest'
// Issue #402 穴埋め学習モード（TDD Red）。
// 本体 src/domain/typing/cloze.service.js は coder が Green で作る（現状未実装＝import で undefined）。
import {
  buildClozeUnits,
  pickClozeTokens,
  computeClozeMask,
  isClozeRevealed,
} from './cloze.service.js'
import { buildUnits, segMatches } from './units.service.js'
import { mulberry32 } from '../rng.service.js'

const item = { en: 'reserve', ja: '予約する', kana: 'よやくする', jaWords: ['予約', 'する'] }

describe('buildClozeUnits（入力対象 seg を伏字にし、反対側を hint に付ける）', () => {
  it("mode='en'：英語 seg に cloze:true が付き、hint に日本語(ja)が入る", () => {
    const segs = buildClozeUnits(item, 'en')
    expect(segs.map((s) => s.type)).toEqual(['en'])
    expect(segs[0].cloze).toBe(true)
    expect(typeof segs[0].hint).toBe('string')
    expect(segs[0].hint).toContain(item.ja)
  })

  it("mode='ja'：読み seg に cloze:true が付き、hint に英語(en)が入る", () => {
    const segs = buildClozeUnits(item, 'ja')
    expect(segs.map((s) => s.type)).toEqual(['ja'])
    expect(segs[0].cloze).toBe(true)
    expect(typeof segs[0].hint).toBe('string')
    expect(segs[0].hint).toContain(item.en)
  })

  // #402 仕様変更：both は en/ja のうち clozeSide で指定した「片側だけ」を伏字にする。
  // 反対側は通常表示（cloze フラグ・hint 無し）＝ヒント/コピーとして見せる。
  it("mode='both' × clozeSide='en'：en seg のみ cloze(hint=ja)、ja seg は非 cloze", () => {
    const segs = buildClozeUnits(item, 'both', { clozeSide: 'en' })
    expect(segs.map((s) => s.type)).toEqual(['en', 'ja'])
    const en = segs.find((s) => s.type === 'en')
    const ja = segs.find((s) => s.type === 'ja')
    expect(en.cloze).toBe(true)
    expect(en.hint).toContain(item.ja) // 英語入力の hint は日本語
    expect(ja.cloze).not.toBe(true) // 反対側（読み）は伏せない
    expect(ja.hint).toBeUndefined() // 通常表示なので hint も付けない
  })

  it("mode='both' × clozeSide='ja'：ja seg のみ cloze(hint=en)、en seg は非 cloze", () => {
    const segs = buildClozeUnits(item, 'both', { clozeSide: 'ja' })
    expect(segs.map((s) => s.type)).toEqual(['en', 'ja'])
    const en = segs.find((s) => s.type === 'en')
    const ja = segs.find((s) => s.type === 'ja')
    expect(ja.cloze).toBe(true)
    expect(ja.hint).toContain(item.en) // 日本語入力の hint は英語
    expect(en.cloze).not.toBe(true) // 反対側（英語）は伏せない
    expect(en.hint).toBeUndefined()
  })

  it("mode='both' × clozeSide 省略：既定側（en）だけ cloze、他方は非 cloze で決定的", () => {
    const segs = buildClozeUnits(item, 'both')
    expect(segs.map((s) => s.type)).toEqual(['en', 'ja'])
    const en = segs.find((s) => s.type === 'en')
    const ja = segs.find((s) => s.type === 'ja')
    expect(en.cloze).toBe(true) // 既定は en 側を伏せる
    expect(en.hint).toContain(item.ja)
    expect(ja.cloze).not.toBe(true)
  })

  it('照合互換：cloze seg でも segMatches は通常 buildUnits と同じ正誤を返す', () => {
    const enCloze = buildClozeUnits(item, 'en')[0]
    const enNormal = buildUnits(item, 'en')[0]
    for (const input of ['', 'r', 'res', 'reserve', 'zzz', 'reserved']) {
      expect(segMatches(enCloze, input)).toBe(segMatches(enNormal, input))
    }
    const jaCloze = buildClozeUnits(item, 'ja')[0]
    const jaNormal = buildUnits(item, 'ja')[0]
    for (const input of ['', 'yo', 'yoyaku', 'yoyakusuru', 'zzz']) {
      expect(segMatches(jaCloze, input)).toBe(segMatches(jaNormal, input))
    }
  })

  it('翻訳モード（en-tr/ja-tr）には cloze を付けない（通常 buildUnits と同等）', () => {
    const enTr = buildClozeUnits(item, 'en-tr', { rng: mulberry32(7) })
    const jaTr = buildClozeUnits(item, 'ja-tr', { rng: mulberry32(7) })
    expect(enTr.every((s) => !s.cloze)).toBe(true)
    expect(jaTr.every((s) => !s.cloze)).toBe(true)
    // translate フラグ等の通常構造は保つ（少なくとも type は buildUnits と一致）
    expect(enTr.map((s) => s.type)).toEqual(buildUnits(item, 'en-tr', { rng: mulberry32(7) }).map((s) => s.type))
  })

  it("kana 欠落時（mode='both'）は読み seg を cloze にせず、存在する英語側のみ cloze", () => {
    const noKana = { en: 'reserve', ja: '予約する' } // kana 無し
    const segs = buildClozeUnits(noKana, 'both')
    const en = segs.find((s) => s.type === 'en')
    const ja = segs.find((s) => s.type === 'ja')
    expect(en.cloze).toBe(true)
    expect(ja?.cloze).not.toBe(true) // 読みが作れない側は伏せない
  })

  it('純粋：item を破壊しない', () => {
    const snapshot = JSON.parse(JSON.stringify(item))
    buildClozeUnits(item, 'both')
    expect(item).toEqual(snapshot)
  })
})

describe('pickClozeTokens（content トークンから min〜max 語の index を昇順で選ぶ）', () => {
  // isContent は注入して選定ロジック自体を検証する（既定の機能語判定は coder 実装）。
  const isContent = (t) => /^[a-z]+$/i.test(t) && !['the', 'a', 'is', 'of'].includes(t)

  it('候補が0（content 無し）なら [] を返す', () => {
    const tokens = ['the', 'a', '.']
    expect(pickClozeTokens(tokens, { rng: () => 0, isContent })).toEqual([])
  })

  it('content トークンが1個ならその index を返す', () => {
    const tokens = ['the', 'cat', '.']
    expect(pickClozeTokens(tokens, { rng: () => 0, min: 1, max: 3, isContent })).toEqual([1])
  })

  it('候補が min 未満なら候補全部を返す（昇順）', () => {
    const tokens = ['the', 'cat', 'is', 'here'] // content=cat(1),here(3)
    const out = pickClozeTokens(tokens, { rng: () => 0, min: 3, max: 3, isContent })
    expect(out).toEqual([1, 3])
  })

  it('min===max のとき、ちょうどその数だけ選ぶ（昇順・重複なし・全て content index）', () => {
    const tokens = ['I', 'drink', 'cold', 'water', 'now'] // 全て content
    const out = pickClozeTokens(tokens, { rng: mulberry32(3), min: 2, max: 2, isContent })
    expect(out).toHaveLength(2)
    const sorted = [...out].sort((x, y) => x - y)
    expect(out).toEqual(sorted) // 昇順
    expect(new Set(out).size).toBe(out.length) // 重複なし
    for (const i of out) expect(isContent(tokens[i])).toBe(true)
  })

  it('選ぶ数は常に [min, min(max, 候補数)] の範囲に収まる', () => {
    const tokens = ['I', 'drink', 'cold', 'water', 'now', 'again']
    for (const seed of [1, 2, 3, 42]) {
      const out = pickClozeTokens(tokens, { rng: mulberry32(seed), min: 1, max: 3, isContent })
      expect(out.length).toBeGreaterThanOrEqual(1)
      expect(out.length).toBeLessThanOrEqual(3)
    }
  })

  it('決定的：同じ rng seed なら同じ結果', () => {
    const tokens = ['I', 'drink', 'cold', 'water', 'now', 'again']
    const a = pickClozeTokens(tokens, { rng: mulberry32(9), min: 1, max: 3, isContent })
    const b = pickClozeTokens(tokens, { rng: mulberry32(9), min: 1, max: 3, isContent })
    expect(a).toEqual(b)
  })

  it('純粋：tokens を破壊せず、返り値は tokens の有効 index のみ', () => {
    const tokens = ['I', 'drink', 'water']
    const snapshot = [...tokens]
    const out = pickClozeTokens(tokens, { rng: mulberry32(1), min: 1, max: 3, isContent })
    expect(tokens).toEqual(snapshot)
    for (const i of out) {
      expect(Number.isInteger(i)).toBe(true)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(tokens.length)
    }
  })
})

describe('computeClozeMask（伏字 index から text の char レンジ [{start,end}] を返す・end 排他）', () => {
  it('例：text="I drink water" の index=1（drink）→ [{start:2,end:7}]', () => {
    expect(computeClozeMask('I drink water', [1])).toEqual([{ start: 2, end: 7 }])
  })

  it('indexes=[] なら [] を返す', () => {
    expect(computeClozeMask('I drink water', [])).toEqual([])
  })

  it('連続 index は結合せず語ごとに1レンジ（index=[0,1]）', () => {
    expect(computeClozeMask('I drink water', [0, 1])).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 7 },
    ])
  })

  it('同じ語が複数回でも index 基準で正しい位置（2つ目の cat）', () => {
    // "cat and cat" → tokens ["cat","and","cat"]、index=2 は末尾 cat（start:8,end:11）
    expect(computeClozeMask('cat and cat', [2])).toEqual([{ start: 8, end: 11 }])
  })

  it('tokenize を注入して分割規則を差し替えできる（和文の文字分割）', () => {
    // 注入 tokenize：1文字ずつに分割 → ["猫","が","水","を","飲","む"]
    const tokenize = (t) => [...t]
    // index=0（猫）と index=4（飲）を伏せる
    expect(computeClozeMask('猫が水を飲む', [0, 4], tokenize)).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
    ])
  })

  it('純粋：レンジは昇順で、start/end は text 長を超えない', () => {
    const text = 'I drink cold water now'
    const out = computeClozeMask(text, [3, 1]) // 入力順が乱れていても
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start)
    }
    for (const r of out) {
      expect(r.start).toBeGreaterThanOrEqual(0)
      expect(r.end).toBeLessThanOrEqual(text.length)
      expect(r.end).toBeGreaterThan(r.start)
    }
  })
})

describe('isClozeRevealed（cloze かつミスありで正体を開示）', () => {
  it("learningMode='cloze' かつ segMistakes>0 なら true", () => {
    expect(isClozeRevealed('cloze', 1)).toBe(true)
    expect(isClozeRevealed('cloze', 5)).toBe(true)
  })

  it("cloze でも segMistakes=0 なら false", () => {
    expect(isClozeRevealed('cloze', 0)).toBe(false)
  })

  it('segMistakes が負なら false（境界）', () => {
    expect(isClozeRevealed('cloze', -1)).toBe(false)
  })

  it('cloze 以外は segMistakes に関わらず false', () => {
    expect(isClozeRevealed('normal', 3)).toBe(false)
    expect(isClozeRevealed(undefined, 3)).toBe(false)
  })
})
