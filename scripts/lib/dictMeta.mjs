// 英英辞典のメタ（DICT_COUNTS / DICT_AVAILABLE_LEVELS）の計算と描画。
// dict 記録（level・theme）から直接算出できる（word→theme 結合は不要）。
// content-build（正準ソース起点）と merge-dict（旧パイプライン）の双方が使う。

// dict: [{level, theme?, ...}], themes: ['日常', ...], levels: [1,2,3,4]
// → { counts: {level:{すべて:n, 日常:n, ...}}, levels: [有効レベル] }
export function computeDictMeta(dict, themes, levels) {
  const counts = {}
  for (const lv of levels) {
    counts[lv] = { すべて: dict.filter((d) => d.level === lv).length }
    for (const t of themes) counts[lv][t] = dict.filter((d) => d.level === lv && d.theme === t).length
  }
  const available = [...new Set(dict.map((d) => d.level))].sort((a, b) => a - b)
  return { counts, levels: available }
}

export function renderDictMetaJs(counts, availableLevels) {
  return (
    '// 自動生成（content-build / merge-dict）。編集しない。英英の level×theme 件数と有効レベル。\n' +
    `export const DICT_COUNTS = ${JSON.stringify(counts)}\n` +
    `export const DICT_AVAILABLE_LEVELS = ${JSON.stringify(availableLevels)}\n`
  )
}
