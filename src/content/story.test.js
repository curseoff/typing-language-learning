import { describe, expect, it } from 'vitest'
import { STORY } from './story.js'

// 物語グラフの整合性。data 側で「1ノード=1文」に分割したため、
// 参照・到達性・単文・jaWords 整合をデータで担保する。
const nodes = STORY.nodes
const ids = Object.keys(nodes)

// あるノードから出る遷移先 id を列挙
function outgoing(node) {
  const out = []
  if (node.next) out.push(node.next)
  if (node.choices) for (const c of node.choices) out.push(c.next)
  return out
}

describe('story graph', () => {
  it('start が存在するノードを指す', () => {
    expect(nodes[STORY.start]).toBeDefined()
  })

  it('全 next / choices[].next が存在するノード id を指す', () => {
    for (const id of ids) {
      for (const target of outgoing(nodes[id])) {
        expect(nodes[target], `${id} -> ${target}`).toBeDefined()
      }
    }
  })

  it('到達不能ノードが無い（start から全ノードに到達できる）', () => {
    const seen = new Set()
    const stack = [STORY.start]
    while (stack.length) {
      const id = stack.pop()
      if (seen.has(id)) continue
      seen.add(id)
      for (const t of outgoing(nodes[id])) stack.push(t)
    }
    expect([...seen].sort()).toEqual([...ids].sort())
  })

  it('全ノードが単文（en に文末終端記号が1つだけ／途中に ". " 等が残らない）', () => {
    for (const id of ids) {
      const en = nodes[id].en
      // 文末以外に終端記号（. ! ?）が無いこと。閉じ引用符は末尾に許す。
      const terminators = en.match(/[.!?]/g) || []
      expect(terminators.length, `${id}: ${en}`).toBe(1)
      expect(/[.!?]["']?$/.test(en), `${id}: en は終端記号で終わる`).toBe(true)
      // 複数文の名残（終端記号＋空白＋大文字）が残っていないこと
      expect(/[.!?]["']?\s+\S/.test(en), `${id}: 複数文の名残`).toBe(false)
    }
  })

  it('ja / kana も単文（。！？が1つだけ）', () => {
    for (const id of ids) {
      const { ja, kana } = nodes[id]
      expect((ja.match(/[。！？]/g) || []).length, `${id}: ja=${ja}`).toBe(1)
      expect((kana.match(/[。！？]/g) || []).length, `${id}: kana=${kana}`).toBe(1)
    }
  })

  it('各ノードの jaWords 連結 = ja', () => {
    for (const id of ids) {
      const node = nodes[id]
      if (!node.jaWords) continue
      expect(node.jaWords.join(''), id).toBe(node.ja)
    }
  })

  it('endingCount 個のエンドが start から到達可能', () => {
    const seen = new Set()
    const stack = [STORY.start]
    while (stack.length) {
      const id = stack.pop()
      if (seen.has(id)) continue
      seen.add(id)
      for (const t of outgoing(nodes[id])) stack.push(t)
    }
    const endings = new Set()
    for (const id of seen) {
      if (nodes[id].ending) endings.add(nodes[id].ending)
    }
    expect(endings.size).toBe(STORY.endingCount)
  })

  it('ending ノードには endLabel が付く', () => {
    for (const id of ids) {
      if (nodes[id].ending) expect(nodes[id].endLabel, id).toBeTruthy()
    }
  })
})
