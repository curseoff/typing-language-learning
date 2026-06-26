import { describe, expect, it } from 'vitest'
import { STORIES } from './stories/index.js'
import { STORY } from './story.js'
import { toRomaji, kanaConsumed } from '../domain/romaji/romaji.js'

// 句読点を除いた kana が canonical(toRomaji) を打つと全かな消費できるか（=実際に打鍵可能か）
const PUNCT = /[。、！？]/g
function typable(kana) {
  const core = kana.replace(PUNCT, '')
  return kanaConsumed(core, toRomaji(core)) >= [...core].length
}

// 物語グラフの整合性。data 側で「1ノード=1文」に分割したため、
// 参照・到達性・単文・jaWords 整合をデータで担保する。全物語に同じ検査をかける。

// あるノードから出る遷移先 id を列挙
function outgoing(node) {
  const out = []
  if (node.next) out.push(node.next)
  if (node.choices) for (const c of node.choices) out.push(c.next)
  return out
}

// start から到達できるノード id 集合
function reachable(story) {
  const seen = new Set()
  const stack = [story.start]
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    for (const t of outgoing(story.nodes[id])) stack.push(t)
  }
  return seen
}

it('STORIES が複数（travel + climbing）で id が一意', () => {
  expect(STORIES.length).toBeGreaterThanOrEqual(2)
  const idsList = STORIES.map((s) => s.id)
  expect(new Set(idsList).size).toBe(idsList.length)
  expect(idsList).toContain('travel')
  expect(idsList).toContain('climbing')
})

it('後方互換の STORY は先頭物語（travel）', () => {
  expect(STORY.id).toBe('travel')
  expect(STORY).toBe(STORIES[0])
})

describe.each(STORIES.map((s) => [s.id, s]))('story graph: %s', (id, story) => {
  const nodes = story.nodes
  const ids = Object.keys(nodes)

  it('id/title/start/endingCount を持つ', () => {
    expect(story.id).toBeTruthy()
    expect(story.title).toBeTruthy()
    expect(story.endingCount).toBeGreaterThan(0)
    expect(nodes[story.start], 'start が存在するノードを指す').toBeDefined()
  })

  it('全 next / choices[].next が存在するノード id を指す', () => {
    for (const nid of ids) {
      for (const target of outgoing(nodes[nid])) {
        expect(nodes[target], `${nid} -> ${target}`).toBeDefined()
      }
    }
  })

  it('到達不能ノードが無い（start から全ノードに到達できる）', () => {
    const seen = reachable(story)
    expect([...seen].sort()).toEqual([...ids].sort())
  })

  it('全ノードが単文（en に文末終端記号が1つだけ／途中に ". " 等が残らない）', () => {
    for (const nid of ids) {
      const en = nodes[nid].en
      const terminators = en.match(/[.!?]/g) || []
      expect(terminators.length, `${nid}: ${en}`).toBe(1)
      expect(/[.!?]["']?$/.test(en), `${nid}: en は終端記号で終わる`).toBe(true)
      expect(/[.!?]["']?\s+\S/.test(en), `${nid}: 複数文の名残`).toBe(false)
    }
  })

  it('ja / kana も単文（。！？が1つだけ）', () => {
    for (const nid of ids) {
      const { ja, kana } = nodes[nid]
      expect((ja.match(/[。！？]/g) || []).length, `${nid}: ja=${ja}`).toBe(1)
      expect((kana.match(/[。！？]/g) || []).length, `${nid}: kana=${kana}`).toBe(1)
    }
  })

  it('ja に鉤括弧「」を含まない', () => {
    for (const nid of ids) {
      expect(/[「」]/.test(nodes[nid].ja), `${nid}: ja=${nodes[nid].ja}`).toBe(false)
      if (nodes[nid].choices) {
        for (const c of nodes[nid].choices) {
          expect(/[「」]/.test(c.ja), `${nid} choice: ${c.ja}`).toBe(false)
        }
      }
    }
  })

  it('各ノードの jaWords 連結 = ja', () => {
    for (const nid of ids) {
      const node = nodes[nid]
      if (!node.jaWords) continue
      expect(node.jaWords.join(''), nid).toBe(node.ja)
    }
  })

  it('endingCount 個のエンドが start から到達可能', () => {
    const seen = reachable(story)
    const endings = new Set()
    for (const nid of seen) {
      if (nodes[nid].ending) endings.add(nodes[nid].ending)
    }
    expect(endings.size).toBe(story.endingCount)
  })

  it('ending ノードには endLabel が付く', () => {
    for (const nid of ids) {
      if (nodes[nid].ending) expect(nodes[nid].endLabel, nid).toBeTruthy()
    }
  })

  it('全ノード/選択肢の kana が canonical で全かな消費できる（=打鍵可能）', () => {
    for (const nid of ids) {
      expect(typable(nodes[nid].kana), `${nid}: kana=${nodes[nid].kana}`).toBe(true)
      if (nodes[nid].choices) {
        for (const c of nodes[nid].choices) {
          expect(typable(c.kana), `${nid} choice: ${c.kana}`).toBe(true)
        }
      }
    }
  })
})
