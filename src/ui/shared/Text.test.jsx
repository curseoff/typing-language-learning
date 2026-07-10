// @vitest-environment jsdom
// per-char 下線(#193)のためのクラス付与を検証する。
// Typed(英文)/RubyTyped(和文) が各文字 span に基底クラス rch を付け、
// done/hasError に応じて .rdone(i<done) / .rerr(i===done&&hasError) を重ねること、
// RubyTyped のふりがな(rt)には rch を付けない(下線をルビと干渉させない)ことを確認する。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Typed, RubyTyped } from './Text.presenter.jsx'

afterEach(cleanup)

describe('Typed の per-char 下線クラス', () => {
  it('全 span に基底クラス rch を付ける', () => {
    const { container } = render(<Typed text="cat" done={0} />)
    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(3)
    spans.forEach((s) => expect(s.classList.contains('rch')).toBe(true))
  })

  it('done 未満は rdone、それ以外は基底のみ(hasError 無し)', () => {
    const { container } = render(<Typed text="cat" done={2} />)
    const spans = [...container.querySelectorAll('span')]
    expect(spans[0].className).toBe('rch rdone')
    expect(spans[1].className).toBe('rch rdone')
    expect(spans[2].className).toBe('rch') // 未入力は基底のみ
  })

  it('hasError のとき done 位置の1文字だけ rerr', () => {
    const { container } = render(<Typed text="cat" done={1} hasError />)
    const spans = [...container.querySelectorAll('span')]
    expect(spans[0].className).toBe('rch rdone')
    expect(spans[1].className).toBe('rch rerr') // 今ミスしている文字
    expect(spans[2].className).toBe('rch')
  })

  it('hasError でも done 位置以外は rerr を付けない', () => {
    const { container } = render(<Typed text="cat" done={0} hasError />)
    const spans = [...container.querySelectorAll('span')]
    expect(spans[0].className).toBe('rch rerr')
    expect(spans[1].className).toBe('rch')
    expect(spans[2].className).toBe('rch')
  })
})

describe('RubyTyped の per-char 下線クラス', () => {
  // 太陽(たいよう): ja='太陽' / kana='たいよう'
  it('本体文字(漢字)の span に基底クラス rch を付ける', () => {
    const { container } = render(<RubyTyped ja="太陽" kana="たいよう" done={0} kanaDone={0} />)
    const bodies = [...container.querySelectorAll('ruby > span')]
    expect(bodies).toHaveLength(2)
    bodies.forEach((s) => expect(s.classList.contains('rch')).toBe(true))
  })

  it('ふりがな(rt)の span には rch を付けない(下線とルビの干渉回避)', () => {
    const { container } = render(<RubyTyped ja="太陽" kana="たいよう" done={0} kanaDone={0} />)
    const rt = [...container.querySelectorAll('rt span')]
    expect(rt).toHaveLength(4) // た い よ う
    rt.forEach((s) => expect(s.classList.contains('rch')).toBe(false))
  })

  it('done に応じ本体文字を rdone、hasError で done 位置を rerr にする', () => {
    const { container } = render(
      <RubyTyped ja="太陽" kana="たいよう" done={1} kanaDone={2} hasError />,
    )
    const bodies = [...container.querySelectorAll('ruby > span')]
    expect(bodies[0].className).toBe('rch rdone') // 打ち終えた漢字
    expect(bodies[1].className).toBe('rch rerr') // 今ミスしている漢字
  })

  it('ふりがなは kanaDone 単位で rdone に着色(rch 無し)', () => {
    const { container } = render(<RubyTyped ja="太陽" kana="たいよう" done={0} kanaDone={2} />)
    const rt = [...container.querySelectorAll('rt span')]
    expect(rt[0].className).toBe('rdone') // た
    expect(rt[1].className).toBe('rdone') // い
    expect(rt[2].className).toBe('') // よ 未入力
    expect(rt[3].className).toBe('') // う
  })

  it('漢字を含まない(かなのみ)語でも本体 span に rch を付ける', () => {
    const { container } = render(<RubyTyped ja="ねこ" kana="ねこ" done={1} kanaDone={1} />)
    const bodies = [...container.querySelectorAll('span')]
    expect(bodies).toHaveLength(2)
    expect(bodies[0].className).toBe('rch rdone')
    expect(bodies[1].className).toBe('rch')
  })
})
