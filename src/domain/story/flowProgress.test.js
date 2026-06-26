import { describe, expect, it } from 'vitest'
import { storyFlowProgress } from './flowProgress.js'
import { alignJaToKana } from '../typing/progress.js'

// 短いノードで決定的に検証
const node = {
  en: 'I am here for sightseeing.',
  ja: '観光で来ました。',
  kana: 'かんこうできました。',
}

describe('storyFlowProgress', () => {
  it('英語入力中（en/both 問わず activeType=en）は入力分だけ進み activeRow=en', () => {
    const r = storyFlowProgress(node, { stage: 'text', mode: 'en', activeType: 'en', input: 'I am' })
    expect(r.enDone).toBe(4)
    expect(r.jaDone).toBe(0)
    expect(r.jaKanaDone).toBe(0)
    expect(r.activeRow).toBe('en')
  })

  it('英語入力分は en.length で頭打ち', () => {
    const long = 'I am here for sightseeing.xxxxx'
    const r = storyFlowProgress(node, { stage: 'text', mode: 'en', activeType: 'en', input: long })
    expect(r.enDone).toBe(node.en.length)
  })

  it('単一言語(en)で和文は参考表示＝進捗0', () => {
    const r = storyFlowProgress(node, { stage: 'text', mode: 'en', activeType: 'en', input: '' })
    expect(r.jaDone).toBe(0)
  })

  it('both で和文入力中は英語完了済み・和文は漢字位置とかな進捗', () => {
    // 「かんこう」まで打つと「観光」(漢字2字)が done、かな4字消費
    const r = storyFlowProgress(node, {
      stage: 'text',
      mode: 'both',
      activeType: 'ja',
      input: 'kankou',
    })
    expect(r.enDone).toBe(node.en.length) // both: 英語は入力済み
    expect(r.jaKanaDone).toBe(4)
    expect(r.activeRow).toBe('ja')
    // jaDone は alignJaToKana 基準で「観光」の2字が消費済み
    const ends = alignJaToKana(node.ja, node.kana)
    let expected = 0
    for (const e of ends) if (e <= 4) expected++
    expect(r.jaDone).toBe(expected)
  })

  it('単一言語(ja)で英語は参考表示＝enDone 0', () => {
    const r = storyFlowProgress(node, { stage: 'text', mode: 'ja', activeType: 'ja', input: '' })
    expect(r.enDone).toBe(0)
    expect(r.activeRow).toBe('ja')
  })

  it('choice 段階はノードを打ち終えた満杯表示・activeRow=null', () => {
    const r = storyFlowProgress(node, { stage: 'choice', mode: 'both', activeType: 'en', input: '' })
    expect(r.enDone).toBe(node.en.length)
    expect(r.jaDone).toBe([...node.ja].length)
    expect(r.jaKanaDone).toBe([...node.kana].length)
    expect(r.activeRow).toBeNull()
  })

  it('和文未入力時は jaDone/jaKanaDone とも 0', () => {
    const r = storyFlowProgress(node, { stage: 'text', mode: 'ja', activeType: 'ja', input: '' })
    expect(r.jaDone).toBe(0)
    expect(r.jaKanaDone).toBe(0)
  })
})
