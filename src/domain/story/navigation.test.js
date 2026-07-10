import { describe, it, expect } from 'vitest'
import { lookahead, firstChoiceNodeId } from './navigation.service.js'

// 物語グラフのナビゲーション（純粋関数）。
// next を辿る先読みと、最初の選択肢ノードIDの探索を固定する。
describe('lookahead（next を辿って先読み）', () => {
  const nodes = {
    a: { next: 'b', text: 'A' },
    b: { next: 'c', text: 'B' },
    c: { next: 'd', text: 'C' },
    d: { text: 'D' }, // 末尾（next なし）
  }

  it('現在ノードから next を辿り、末尾に達したら止まる', () => {
    const seq = lookahead(nodes.a, nodes, 4)
    expect(seq.map((n) => n.text)).toEqual(['B', 'C', 'D'])
  })

  it('limit で先読み件数を打ち切る', () => {
    const seq = lookahead(nodes.a, nodes, 2)
    expect(seq.map((n) => n.text)).toEqual(['B', 'C'])
  })

  it('next が無いノードからは空配列を返す', () => {
    expect(lookahead(nodes.d, nodes, 4)).toEqual([])
  })
})

describe('firstChoiceNodeId（最初の選択肢ノードID）', () => {
  it('choices を持つ最初のノードのキーを返す', () => {
    const nodes = {
      intro: { next: 'q1', text: '導入' },
      q1: { choices: [{ label: 'はい' }, { label: 'いいえ' }], text: '分岐' },
    }
    expect(firstChoiceNodeId(nodes)).toBe('q1')
  })

  it('どのノードにも choices が無ければ null を返す', () => {
    const nodes = {
      a: { next: 'b', text: 'A' },
      b: { text: 'B' },
    }
    expect(firstChoiceNodeId(nodes)).toBeNull()
  })
})
