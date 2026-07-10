// 物語グラフのナビゲーション（純粋）。

// 現在ノードから next を辿って先読み（最大 limit 件）
export function lookahead(node, nodes, limit = 4) {
  const out = []
  let n = node
  while (n.next && out.length < limit) {
    n = nodes[n.next]
    out.push(n)
  }
  return out
}

// 最初の選択肢ノードのID（Devジャンプ用）
export function firstChoiceNodeId(nodes) {
  return Object.keys(nodes).find((k) => nodes[k].choices) ?? null
}
