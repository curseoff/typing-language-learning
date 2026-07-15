import { describe, it, expect } from 'vitest'
// Issue #402 穴埋め学習モード（TDD Red）。
// 本体 src/domain/typing/cloze.service.js は coder が Green で作る（現状未実装＝import で undefined）。
import {
  buildClozeUnits,
  pickClozeTokens,
  computeClozeMask,
  isClozeRevealed,
  buildClozeSentence,
  // #412 seed 導出の集約（現状 useMarathon/useDict/useWords にインライン）。coder が Green で追加。
  clozeMaskRng,
  clozeSideFor,
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

// #402 例文/英英の「文中 1〜3 語伏字」の合成関数。pickClozeTokens + computeClozeMask を束ね、
// 打鍵対象文（en＝英文／dict も toDictSeg で def を item.en に載せる）の内容語を char レンジでマスクする。
// 今回の必須仕様は「en 対象のみ」＝ target は item.en に確定する。
// ja/読み側のマスクは分割規則が複雑なため今回は対象外（別途拡張・ranges:[] 許容）。
describe('buildClozeSentence（打鍵対象の英文から内容語 1〜3 語を char レンジでマスクする合成）', () => {
  // 内容語＝drink / cold / water（'I' は機能語で除外）。末尾句読点なし。
  const sentA = { en: 'I drink cold water', ja: '私は冷たい水を飲む', kana: 'わたしはつめたいみずをのむ' }
  // 内容語＝cat / sat / mat（the/on/末尾ピリオドは除外）。
  const sentB = { en: 'The cat sat on the mat.', ja: '猫がマットに座った。', kana: 'ねこがまっとにすわった' }

  const inBounds = (r, target) => r.start >= 0 && r.end <= target.length && r.end > r.start

  it('target は打鍵対象の英文（item.en）と一致する', () => {
    const out = buildClozeSentence(sentA, 'en', { rng: mulberry32(1) })
    expect(out.target).toBe(sentA.en)
  })

  it('ranges は既定（min=1,max=3）で 1〜3 個に収まる', () => {
    for (const seed of [1, 2, 3, 42]) {
      const out = buildClozeSentence(sentA, 'en', { rng: mulberry32(seed) })
      expect(out.ranges.length).toBeGreaterThanOrEqual(1)
      expect(out.ranges.length).toBeLessThanOrEqual(3)
    }
  })

  it('決定的：同じ item・同じ rng seed なら同じ ranges', () => {
    const a = buildClozeSentence(sentA, 'en', { rng: mulberry32(9) })
    const b = buildClozeSentence(sentA, 'en', { rng: mulberry32(9) })
    expect(a.ranges).toEqual(b.ranges)
  })

  it('min===max のとき、ちょうどその数の内容語をマスクする', () => {
    const out2 = buildClozeSentence(sentA, 'en', { rng: mulberry32(2), min: 2, max: 2 })
    expect(out2.ranges).toHaveLength(2)
    const out1 = buildClozeSentence(sentA, 'en', { rng: mulberry32(2), min: 1, max: 1 })
    expect(out1.ranges).toHaveLength(1)
  })

  it('各 range は語境界に一致し、内容語そのものを覆う（語の途中で切れない・end 排他・target 長内）', () => {
    const target = sentA.en
    const content = new Set(['drink', 'cold', 'water'])
    const out = buildClozeSentence(sentA, 'en', { rng: mulberry32(7), min: 3, max: 3 })
    expect(out.ranges).toHaveLength(3)
    for (const r of out.ranges) {
      expect(inBounds(r, target)).toBe(true)
      const word = target.slice(r.start, r.end)
      expect(content.has(word)).toBe(true) // 前後に空白/句読点を含まず、内容語ちょうど
      if (r.start > 0) expect(target[r.start - 1]).toBe(' ') // 語頭境界
      if (r.end < target.length) expect(target[r.end]).toBe(' ') // 語末境界
    }
  })

  it('ranges は昇順（非重複・start が単調増加）で返る', () => {
    const out = buildClozeSentence(sentA, 'en', { rng: mulberry32(7), min: 3, max: 3 })
    for (let i = 1; i < out.ranges.length; i++) {
      expect(out.ranges[i].start).toBeGreaterThanOrEqual(out.ranges[i - 1].end)
    }
  })

  it('機能語・句読点はマスクしない（末尾ピリオドを含む文でも内容語だけを覆う）', () => {
    const target = sentB.en
    const content = new Set(['cat', 'sat', 'mat'])
    const out = buildClozeSentence(sentB, 'en', { rng: mulberry32(5), min: 3, max: 3 })
    expect(out.ranges).toHaveLength(3)
    for (const r of out.ranges) {
      const word = target.slice(r.start, r.end)
      expect(/^[A-Za-z]+$/.test(word)).toBe(true) // 句読点を含まない（"mat." にならない）
      expect(content.has(word)).toBe(true)
    }
  })

  it('内容語が1語だけの文はその1語をマスクする', () => {
    const one = { en: 'run', ja: '走る', kana: 'はしる' }
    const out = buildClozeSentence(one, 'en', { rng: mulberry32(1) })
    expect(out.ranges).toEqual([{ start: 0, end: 3 }])
  })

  it('内容語が無い文（機能語のみ）は ranges を空にする', () => {
    const none = { en: 'the a of', ja: '—', kana: '' }
    const out = buildClozeSentence(none, 'en', { rng: mulberry32(1) })
    expect(out.ranges).toEqual([])
  })

  it('純粋：item を破壊しない', () => {
    const snapshot = JSON.parse(JSON.stringify(sentB))
    buildClozeSentence(sentB, 'en', { rng: mulberry32(3) })
    expect(sentB).toEqual(snapshot)
  })
})

// #402 ja（読み）モードの文中マスク拡張。en では item.en を対象にするが、ja では和文（item.ja）を
// 表示対象にし、語分割ソースは item.jaWords（文字列配列。連結すると item.ja を末尾句読点を除いて再構成）。
// 打鍵照合は不変（読みを打つ）＝ranges は表示マスク用メタ。実データ形は wordSentences（L*.js）/stories に準拠：
//   { en, word, ja, kana, jaWords: ['私','は','毎朝','水','を','飲み','ます'] } のように jaWords は string[]。
describe('buildClozeSentence（ja モード：和文 item.ja の内容語を jaWords 境界で char マスクする）', () => {
  // 内容語候補＝私 / 毎朝 / 水 / 飲み（は・を は助詞で除外・末尾「。」も除外）。ます は補助的なので不問。
  const jaA = {
    en: 'I drink water every morning.',
    ja: '私は毎朝水を飲みます。',
    kana: 'わたしはまいあさみずをのみます。',
    jaWords: ['私', 'は', '毎朝', '水', 'を', '飲み', 'ます'],
  }
  // 内容語候補＝彼女 / 良い / 友達（は・です を除外）。
  const jaB = {
    en: 'She is a good friend.',
    ja: '彼女は良い友達です。',
    kana: 'かのじょはよいともだちです。',
    jaWords: ['彼女', 'は', '良い', '友達', 'です'],
  }

  const PARTICLES = new Set(['は', 'を', 'が', 'に', 'の'])
  const inBounds = (r, target) => r.start >= 0 && r.end <= target.length && r.end > r.start

  it('target は表示する和文（item.ja）と一致する', () => {
    const out = buildClozeSentence(jaA, 'ja', { rng: mulberry32(1) })
    expect(out.target).toBe(jaA.ja)
  })

  it('ranges は既定（min=1,max=3）で 1〜3 個に収まる', () => {
    for (const seed of [1, 2, 3, 42]) {
      const out = buildClozeSentence(jaA, 'ja', { rng: mulberry32(seed) })
      expect(out.ranges.length).toBeGreaterThanOrEqual(1)
      expect(out.ranges.length).toBeLessThanOrEqual(3)
    }
  })

  it('決定的：同じ item・同じ rng seed なら同じ ranges', () => {
    const a = buildClozeSentence(jaA, 'ja', { rng: mulberry32(9) })
    const b = buildClozeSentence(jaA, 'ja', { rng: mulberry32(9) })
    expect(a.ranges).toEqual(b.ranges)
  })

  it('min===max のとき、ちょうどその数の語をマスクする', () => {
    const out3 = buildClozeSentence(jaA, 'ja', { rng: mulberry32(2), min: 3, max: 3 })
    expect(out3.ranges).toHaveLength(3)
    const out1 = buildClozeSentence(jaA, 'ja', { rng: mulberry32(2), min: 1, max: 1 })
    expect(out1.ranges).toHaveLength(1)
  })

  it('各 range は jaWords の語境界に一致し、その語ちょうどを覆う（語の途中で切れない・end 排他・target 長内）', () => {
    const target = jaA.ja
    const words = new Set(jaA.jaWords)
    const out = buildClozeSentence(jaA, 'ja', { rng: mulberry32(7), min: 3, max: 3 })
    expect(out.ranges).toHaveLength(3)
    for (const r of out.ranges) {
      expect(inBounds(r, target)).toBe(true)
      const w = target.slice(r.start, r.end)
      expect(words.has(w)).toBe(true) // jaWords のいずれかの語ちょうど（境界一致）
    }
  })

  it('ranges は昇順（非重複・start が単調増加）で返る', () => {
    const out = buildClozeSentence(jaA, 'ja', { rng: mulberry32(7), min: 3, max: 3 })
    for (let i = 1; i < out.ranges.length; i++) {
      expect(out.ranges[i].start).toBeGreaterThanOrEqual(out.ranges[i - 1].end)
    }
  })

  it('助詞・句読点はマスクしない（は/を/が/に/の と「。」を覆わない）', () => {
    const target = jaA.ja
    for (const seed of [1, 2, 3, 5, 7, 42]) {
      const out = buildClozeSentence(jaA, 'ja', { rng: mulberry32(seed) })
      for (const r of out.ranges) {
        const w = target.slice(r.start, r.end)
        expect(PARTICLES.has(w)).toBe(false) // 助詞は伏せない
        expect(/[。、！？]/.test(w)).toBe(false) // 句読点を含まない
      }
    }
  })

  it('別の和文でも内容語のみを jaWords 境界で覆う', () => {
    const target = jaB.ja
    const words = new Set(jaB.jaWords)
    const out = buildClozeSentence(jaB, 'ja', { rng: mulberry32(5), min: 2, max: 2 })
    expect(out.ranges).toHaveLength(2)
    for (const r of out.ranges) {
      const w = target.slice(r.start, r.end)
      expect(words.has(w)).toBe(true)
      expect(PARTICLES.has(w)).toBe(false)
    }
  })

  it('jaWords が無い item（dict 等）では ranges を空にする', () => {
    const noWords = { en: 'run', ja: '走る', kana: 'はしる' } // jaWords 無し
    const out = buildClozeSentence(noWords, 'ja', { rng: mulberry32(1) })
    expect(out.target).toBe(noWords.ja)
    expect(out.ranges).toEqual([])
  })

  it('jaWords が空配列でも ranges を空にする', () => {
    const emptyWords = { en: 'run', ja: '走る', kana: 'はしる', jaWords: [] }
    const out = buildClozeSentence(emptyWords, 'ja', { rng: mulberry32(1) })
    expect(out.ranges).toEqual([])
  })

  it('純粋：item を破壊しない（jaWords も含め）', () => {
    const snapshot = JSON.parse(JSON.stringify(jaA))
    buildClozeSentence(jaA, 'ja', { rng: mulberry32(3) })
    expect(jaA).toEqual(snapshot)
  })

  it('回帰：en モードは従来どおり item.en を対象にする（ja 拡張で壊さない）', () => {
    const out = buildClozeSentence(jaA, 'en', { rng: mulberry32(1) })
    expect(out.target).toBe(jaA.en) // ja 拡張後も en は英文のまま
  })

  // #404 dict 由来の item（def を持つ英英エントリ）でも ja マスクは item.ja/jaWords に依存し、
  // def（英語定義）に引きずられないこと。useDict の toDictSeg が def→en に載せ替えるが、
  // ja モードのマスク対象はあくまで和文（item.ja）＋語境界（jaWords）である。
  const dictItem = {
    word: 'water',
    en: 'a clear liquid people drink', // dict の def（en に載る）
    ja: '水を飲む',
    kana: 'みずをのむ',
    jaWords: ['水', 'を', '飲む'],
  }

  it('dict 由来 item（jaWords あり）でも target は和文で、内容語（水/飲む）を jaWords 境界で覆う', () => {
    const target = dictItem.ja
    const words = new Set(dictItem.jaWords)
    for (const seed of [1, 2, 3, 7, 42]) {
      const out = buildClozeSentence(dictItem, 'ja', { rng: mulberry32(seed) })
      expect(out.target).toBe(target) // en(def) ではなく和文
      expect(out.ranges.length).toBeGreaterThanOrEqual(1)
      for (const r of out.ranges) {
        const w = target.slice(r.start, r.end)
        expect(words.has(w)).toBe(true)
        expect(PARTICLES.has(w)).toBe(false) // 助詞「を」は伏せない
        expect(inBounds(r, target)).toBe(true)
      }
    }
  })

  it('dict 由来 item に jaWords が無い（実 dict の一部）と ja でも ranges を空にする', () => {
    const noWords = { word: 'run', en: 'to move fast', ja: '走る', kana: 'はしる' }
    const out = buildClozeSentence(noWords, 'ja', { rng: mulberry32(1) })
    expect(out.target).toBe(noWords.ja)
    expect(out.ranges).toEqual([])
  })
})

// ---- #412 seed 導出の集約（挙動不変リファクタ・Red） ----
// 現状 useMarathon.js:46 / useDict.js:47 の maskRngFactory と useWords.js:75-82 の clozeSideOf は
// いずれも fnv1a（domain/rng へ抽出予定）+ mulberry32 を「seed と語キーで混ぜる」同じ式を持つ。
// これを cloze.service へ集約する。ここでは抽出後の関数が現行インライン式と同値であることを pin する。
// 期待値は現行式（mulberry32((fnv1a(key) ^ (seed>>>0)) >>> 0)）を node 実行して取得。

// 参照実装（現行インライン式そのまま）。抽出後の domain 関数がこれと一致することを検証する。
function fnv1aRef(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
const maskRngRef = (seed, key) => mulberry32((fnv1aRef(key) ^ (seed >>> 0)) >>> 0)
const sideRef = (seed, key) => (mulberry32(fnv1aRef(key) ^ (seed >>> 0))() < 0.5 ? 'en' : 'ja')

describe('clozeMaskRng（#412：seed×語キーで決定的な mask 用 rng を返す）', () => {
  it('現行 maskRngFactory と同じ乱数列（先頭5値）を返す＝厳密一致で pin', () => {
    // 期待値は現行式 mulberry32((fnv1a('above') ^ (12345>>>0)) >>> 0) を node 実行して取得。
    const r = clozeMaskRng(12345, 'above')
    const seq = [r(), r(), r(), r(), r()]
    expect(seq).toEqual([
      0.7259057078044862,
      0.0051703189965337515,
      0.14887121808715165,
      0.8095005212817341,
      0.97914310824126,
    ])
  })

  it('複数の (seed,key) で現行インライン式と乱数列が完全一致する', () => {
    for (const seed of [0, 1, 12345, 987654321]) {
      for (const key of ['above', 'reserve', 'cat', 'apple']) {
        const got = clozeMaskRng(seed, key)
        const ref = maskRngRef(seed, key)
        for (let i = 0; i < 4; i++) expect(got()).toBe(ref())
      }
    }
  })

  it('決定的：同じ (seed,key) から作った rng は同じ列を返す（呼び出しごとに新しい発生器）', () => {
    const a = clozeMaskRng(7, 'reserve')
    const b = clozeMaskRng(7, 'reserve')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe("clozeSideFor（#412：seed×語キーで 'en'/'ja' を語ごとに決める）", () => {
  it('現行 clozeSideOf と同じ side を返す（seed=12345 で en/ja 両方が出る）', () => {
    // 現行式 mulberry32(fnv1a(key) ^ (seed>>>0))() < 0.5 ? 'en' : 'ja' を node 実行して取得。
    expect(clozeSideFor(12345, 'above')).toBe('ja')
    expect(clozeSideFor(12345, 'reserve')).toBe('ja')
    expect(clozeSideFor(12345, 'dog')).toBe('en')
    expect(clozeSideFor(12345, 'house')).toBe('en')
  })

  it('複数の (seed,key) で現行インライン式と side が完全一致する', () => {
    for (const seed of [0, 1, 12345, 987654321]) {
      for (const key of ['above', 'reserve', 'cat', 'apple', 'dog', 'house', 'tree', 'book']) {
        expect(clozeSideFor(seed, key)).toBe(sideRef(seed, key))
      }
    }
  })

  it("戻り値は 'en' または 'ja' のいずれか", () => {
    for (const key of ['above', 'dog', 'house', 'book']) {
      expect(['en', 'ja']).toContain(clozeSideFor(12345, key))
    }
  })

  it('決定的：同じ (seed,key) は常に同じ side を返す', () => {
    expect(clozeSideFor(42, 'reserve')).toBe(clozeSideFor(42, 'reserve'))
  })
})
