// @vitest-environment jsdom
// #402 穴埋め学習モードの伏字 presenter smoke。
// MaskedText / MaskedSentence / MaskedRubySentence / MaskedRuby / MaskedRubyText の
// 主要分岐（typed / cursor / hasError / masked / reveal / 空白 / ふりがな）を代表 props で通す。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import {
  MaskedText,
  MaskedSentence,
  MaskedRubySentence,
  MaskedRuby,
  MaskedRubyText,
} from './Text.presenter'

afterEach(cleanup)

describe('Masked presenters smoke (#402)', () => {
  it('MaskedText: 空白を含む文でカーソル/ミス/伏字を描く', () => {
    // typed(i<pos) / cursor(i===pos, err) / hidden / 空白(ch===" ")の各枝を通す。
    const { container } = render(<MaskedText text="I am" pos={2} hasError={true} />)
    expect(container.querySelector('.typed')).toBeTruthy()
    expect(container.querySelector('.mcur')).toBeTruthy()
    expect(container.querySelector('.hidden')).toBeTruthy()
    // カーソルにミスが無い版も。
    render(<MaskedText text="I am" pos={2} hasError={false} />)
    expect(container.textContent?.length).toBeGreaterThan(0)
  })

  it('MaskedSentence: レンジ内を伏字・レンジ外を文脈表示（reveal 無し）', () => {
    // "I like books" のうち "books"(7-12) を伏字に。done=2 で "I " まで打鍵済み。
    const text = 'I like books'
    const ranges = [{ start: 7, end: 12 }]
    const { container } = render(
      <MaskedSentence text={text} ranges={ranges} done={2} hasError={false} reveal={false} />,
    )
    // 打鍵済み（rdone）・伏字（hidden or mcur）が両方ある。
    expect(container.querySelector('.rdone')).toBeTruthy()
    expect(container.querySelector('.mch')).toBeTruthy()
    // レンジ外の文脈語 "like" はそのまま見える。
    expect(container.textContent).toContain('like')
  })

  it('MaskedSentence: カーソルが伏字語の先頭に来たらミス色（mcur err）', () => {
    // done=7 → "books" の先頭 'b'(index7) がカーソル。hasError で mcur err。
    const text = 'I like books'
    const ranges = [{ start: 7, end: 12 }]
    const { container } = render(
      <MaskedSentence text={text} ranges={ranges} done={7} hasError={true} reveal={false} />,
    )
    expect(container.querySelector('.mcur')).toBeTruthy()
    expect(container.querySelector('.err')).toBeTruthy()
  })

  it('MaskedSentence: 文脈文字の今打つ位置でミスすると rerr（伏字語の外）', () => {
    // done=2（"like" の 'l' 相当・レンジ外）でミス → rerr。
    const text = 'I like books'
    const ranges = [{ start: 7, end: 12 }]
    const { container } = render(
      <MaskedSentence text={text} ranges={ranges} done={2} hasError={true} reveal={false} />,
    )
    expect(container.querySelector('.rerr')).toBeTruthy()
  })

  it('MaskedSentence: reveal でカーソルを含む伏字語が丸ごと現れる', () => {
    const text = 'I like books'
    const ranges = [{ start: 7, end: 12 }]
    const { container } = render(
      <MaskedSentence text={text} ranges={ranges} done={8} hasError={false} reveal={true} />,
    )
    // 開示された語は伏字にならず本文が見える。
    expect(container.textContent).toContain('books')
  })

  it('MaskedRubySentence: ルビ語を伏字にしつつ非ルビ部を文脈表示', () => {
    // "本を読む" の "本"(0-1) を伏字レンジに、"読"(2) は漢字ルビ。done=0/kanaDone=0。
    const ja = '本を読む'
    const kana = 'ほんをよむ'
    const ranges = [{ start: 0, end: 1 }]
    const { container } = render(
      <MaskedRubySentence ja={ja} kana={kana} ranges={ranges} done={0} kanaDone={0} hasError={false} reveal={false} />,
    )
    expect(container.querySelector('ruby')).toBeTruthy()
    // マスク内は '·' が出る。
    expect(container.textContent).toContain('·')
  })

  it('MaskedRubySentence: done/kanaDone 進行で本体とふりがなが現れ、hasError でカーソル赤', () => {
    const ja = '本を読む'
    const kana = 'ほんをよむ'
    const ranges = [{ start: 2, end: 3 }] // "読" を伏字に
    const { container } = render(
      <MaskedRubySentence ja={ja} kana={kana} ranges={ranges} done={2} kanaDone={2} hasError={true} reveal={false} />,
    )
    // done=2 なので "本を" は rdone、カーソル(2)は伏字語先頭でミス → mcur err。
    expect(container.querySelector('.rdone')).toBeTruthy()
    expect(container.querySelector('.mcur')).toBeTruthy()
  })

  it('MaskedRubySentence: reveal で伏字語（ふりがなごと）が現れる', () => {
    const ja = '本を読む'
    const kana = 'ほんをよむ'
    const ranges = [{ start: 0, end: 1 }]
    const { container } = render(
      <MaskedRubySentence ja={ja} kana={kana} ranges={ranges} done={0} kanaDone={0} hasError={false} reveal={true} />,
    )
    expect(container.textContent).toContain('本')
  })

  it('MaskedRuby: 本体とふりがなを done/kanaDone まで現し、以降を伏字', () => {
    // 漢字ルビ "辞書" を done=1/kanaDone=1 → "辞" と読み1文字が現れ、残りは伏字。
    const { container } = render(
      <MaskedRuby ja="辞書" kana="じしょ" done={1} kanaDone={1} hasError={false} />,
    )
    expect(container.querySelector('.typed')).toBeTruthy()
    expect(container.querySelector('.hidden')).toBeTruthy()
    expect(container.querySelector('ruby')).toBeTruthy()
  })

  it('MaskedRuby: カーソル位置のミスで mcur err、非ルビ語も描ける', () => {
    // done=0 で先頭がカーソル、hasError。空白入りの非ルビ語も。
    const { container } = render(
      <MaskedRuby ja="ねこ が" kana="ねこ が" done={0} kanaDone={0} hasError={true} />,
    )
    expect(container.querySelector('.mcur')).toBeTruthy()
    expect(container.querySelector('.err')).toBeTruthy()
  })

  it('MaskedRubyText: ja 無しは null、kana 無しは全角マスク、両方でルビマスク', () => {
    const { container: empty } = render(<MaskedRubyText ja="" />)
    expect(empty.textContent).toBe('')
    const { container: noKana } = render(<MaskedRubyText ja="辞書" />)
    expect(noKana.textContent).toContain('＊')
    const { container: full } = render(<MaskedRubyText ja="辞書" kana="じしょ" />)
    expect(full.querySelector('ruby')).toBeTruthy()
  })
})
