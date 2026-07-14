// @vitest-environment jsdom
// #402 穴埋め学習モードの Flow 描画分岐 smoke。
// 単一言語(FlowRow)と both(PairFlow)の cloze / clozeSide / clozeRanges / clozeRevealed の
// 各枝（現在=伏字打鍵中 / これから=全伏字 / 過去=表示 / ミス開示）を代表 props で通す。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Flow } from './Flow.presenter'

afterEach(cleanup)

// 単語モード（cloze=語全体伏字）用。en は 1語、ja はルビ有無を混ぜる。
const wordItems = [
  { en: 'apple', ja: 'りんご', kana: 'りんご', cloze: true, sentenceIndex: 0 },
  { en: 'book', ja: '本', kana: 'ほん', cloze: true, sentenceIndex: 1 },
]
// ふりがな無し（漢字なし）の cloze 語。
const wordItemsNoKana = [
  { en: 'go', ja: 'いく', cloze: true, sentenceIndex: 0 },
  { en: 'run', ja: 'はしる', cloze: true, sentenceIndex: 1 },
]

describe('Flow cloze（単語モード・単一言語）(#402)', () => {
  it('en 入力：現在語は伏字＋打鍵、これからは全伏字、過去は表示', () => {
    // cur=0：item0 が現在（伏字打鍵中）、item1 が future（全伏字）。
    const { container } = render(
      <Flow items={wordItems} cur={0} enDone={2} jaDone={0} activeRow="en" ticker showEn showJa={false} />,
    )
    expect(container.querySelector('.mch')).toBeTruthy() // 伏字が出ている
  })

  it('en 入力：ミス開示で現在語が通常表示（Typed）に開示される', () => {
    const { container } = render(
      <Flow items={wordItems} cur={0} enDone={2} jaDone={0} activeRow="en" ticker showEn showJa={false} clozeRevealed hasError />,
    )
    expect(container.textContent).toContain('apple')
  })

  it('en 入力：cur=1 で item0 が過去＝そのまま表示される', () => {
    const { container } = render(
      <Flow items={wordItems} cur={1} enDone={1} jaDone={0} activeRow="en" ticker showEn showJa={false} />,
    )
    expect(container.textContent).toContain('apple') // past は伏せない
  })

  it('ja 入力：ルビ語の伏字（MaskedRuby）と、ミス開示（RubyTyped）', () => {
    const { container: masked } = render(
      <Flow items={wordItems} cur={0} enDone={0} jaDone={1} jaKanaDone={1} activeRow="ja" ticker showEn={false} showJa hasError />,
    )
    expect(masked.querySelector('.mch')).toBeTruthy()
    const { container: revealed } = render(
      <Flow items={wordItems} cur={0} enDone={0} jaDone={1} jaKanaDone={1} activeRow="ja" ticker showEn={false} showJa clozeRevealed />,
    )
    expect(revealed.querySelector('ruby')).toBeTruthy()
  })

  it('ja 入力：ふりがな無し語は MaskedText で伏字、開示は Typed', () => {
    const { container: masked } = render(
      <Flow items={wordItemsNoKana} cur={0} enDone={0} jaDone={1} activeRow="ja" ticker showEn={false} showJa />,
    )
    expect(masked.querySelector('.mch')).toBeTruthy()
    const { container: revealed } = render(
      <Flow items={wordItemsNoKana} cur={0} enDone={0} jaDone={1} activeRow="ja" ticker showEn={false} showJa clozeRevealed />,
    )
    expect(revealed.textContent).toContain('いく')
  })
})

// 例文/英英モード（clozeRanges=文中の内容語だけ伏字）。
const sentItems = [
  {
    en: 'I read a book',
    ja: '私は本を読む',
    kana: 'わたしはほんをよむ',
    clozeRanges: [{ start: 7, end: 13 }], // "a book"
    sentenceIndex: 0,
  },
]
const sentItemsNoKana = [
  {
    en: 'I read a book',
    ja: 'I read a book',
    clozeRanges: [{ start: 7, end: 13 }],
    sentenceIndex: 0,
  },
]

describe('Flow clozeRanges（例文文中伏字・単一言語）(#402)', () => {
  it('en 入力：文中レンジが MaskedSentence で伏字になる', () => {
    const { container } = render(
      <Flow items={sentItems} cur={0} enDone={2} jaDone={0} activeRow="en" wrap showEn showJa={false} />,
    )
    expect(container.querySelector('.mch')).toBeTruthy()
    expect(container.textContent).toContain('read') // レンジ外は文脈表示
  })

  it('ja 入力：ルビ文はふりがなごと MaskedRubySentence で伏字（開示可）', () => {
    const { container } = render(
      <Flow items={sentItems} cur={0} enDone={0} jaDone={3} jaKanaDone={4} activeRow="ja" wrap showEn={false} showJa clozeRevealed hasError />,
    )
    expect(container.querySelector('ruby')).toBeTruthy()
  })

  it('ja 入力：ふりがな無し文は MaskedSentence で伏字', () => {
    const { container } = render(
      <Flow items={sentItemsNoKana} cur={0} enDone={0} jaDone={2} activeRow="ja" wrap showEn={false} showJa />,
    )
    expect(container.querySelector('.mch')).toBeTruthy()
  })
})

// both（PairFlow）：clozeSide で片側だけ伏字。
const pairEnSide = [
  { en: 'apple', ja: 'りんご', kana: 'りんご', cloze: true, clozeSide: 'en', sentenceIndex: 0 },
  { en: 'book', ja: '本', kana: 'ほん', cloze: true, clozeSide: 'en', sentenceIndex: 1 },
]
const pairJaSide = [
  { en: 'apple', ja: 'りんご', kana: 'りんご', cloze: true, clozeSide: 'ja', sentenceIndex: 0 },
  { en: 'book', ja: '本', kana: 'ほん', cloze: true, clozeSide: 'ja', sentenceIndex: 1 },
]
const pairJaSideNoKana = [
  { en: 'go', ja: 'いく', cloze: true, clozeSide: 'ja', sentenceIndex: 0 },
]
const pairRanges = [
  {
    en: 'I read a book',
    ja: '私は本を読む',
    kana: 'わたしはほんをよむ',
    clozeRanges: [{ start: 7, end: 13 }],
    sentenceIndex: 0,
  },
]

describe('Flow cloze（both / PairFlow）(#402)', () => {
  it('clozeSide=en：英語側のみ伏字（MaskedText）、和訳は表示', () => {
    const { container } = render(
      <Flow items={pairEnSide} cur={0} enDone={2} jaDone={0} activeRow="en" ticker isBoth showEn showJa hasError />,
    )
    expect(container.querySelector('.pair-en .mch')).toBeTruthy()
    expect(container.textContent).toContain('りんご') // ja 側は伏せない
  })

  it('clozeSide=en：ミス開示で英語側が Typed 表示に開示', () => {
    const { container } = render(
      <Flow items={pairEnSide} cur={0} enDone={2} jaDone={0} activeRow="en" ticker isBoth showEn showJa clozeRevealed hasError />,
    )
    expect(container.querySelector('.pair-en')?.textContent).toContain('apple')
  })

  it('clozeSide=ja：読み側のみ伏字（MaskedRuby）、英語は表示。開示は renderJa', () => {
    const { container: masked } = render(
      <Flow items={pairJaSide} cur={0} enDone={0} jaDone={1} jaKanaDone={1} activeRow="ja" ticker isBoth showEn showJa hasError />,
    )
    expect(masked.querySelector('.pair-ja .mch')).toBeTruthy()
    expect(masked.textContent).toContain('apple')
    const { container: revealed } = render(
      <Flow items={pairJaSide} cur={0} enDone={0} jaDone={1} jaKanaDone={1} activeRow="ja" ticker isBoth showEn showJa clozeRevealed />,
    )
    expect(revealed.querySelector('.pair-ja ruby')).toBeTruthy()
  })

  it('clozeSide=ja：ふりがな無し語は MaskedText で伏字', () => {
    const { container } = render(
      <Flow items={pairJaSideNoKana} cur={0} enDone={0} jaDone={1} activeRow="ja" ticker isBoth showEn showJa />,
    )
    expect(container.querySelector('.pair-ja .mch')).toBeTruthy()
  })

  it('cur=1 で PairFlow の過去ペアは両側とも表示（伏字なし）', () => {
    const { container } = render(
      <Flow items={pairEnSide} cur={1} enDone={1} jaDone={0} activeRow="en" ticker isBoth showEn showJa />,
    )
    // item0(past)の英語がそのまま出る。
    expect(container.querySelector('.flow-pair.past')?.textContent).toContain('apple')
  })

  it('clozeRanges：PairFlow の英語側が MaskedSentence で文中伏字', () => {
    const { container } = render(
      <Flow items={pairRanges} cur={0} enDone={2} jaDone={0} activeRow="en" ticker isBoth showEn showJa />,
    )
    expect(container.querySelector('.pair-en .mch')).toBeTruthy()
    expect(container.textContent).toContain('read')
  })
})
