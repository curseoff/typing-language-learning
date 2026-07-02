// 単語例文のテーマ絞り込みメタ（theme.js / WSENT_COUNTS）の計算と描画。
// 例文データには theme が無いため、見出し語 word → theme を単語データから引き、
// レベル別の word→theme マップと level×theme の件数を組み立てる。
// content-build（正準ソース起点）と gen-wsent-theme（旧パイプライン）の双方が使う。

const LEVELS = [1, 2, 3, 4]

// sentences: [{level, word, ...}], words: [{en, theme?}], themes: ['日常', ...]
// → { themeMap: {level:{word:theme}}, counts: {level:{すべて:n, 日常:n, ...}} }
export function computeWsentMeta(sentences, words, themes, levels = LEVELS) {
  const themeOf = new Map(words.filter((w) => w.theme).map((w) => [w.en, w.theme]))
  const themeMap = {}
  const counts = {}
  for (const lv of levels) {
    themeMap[lv] = {}
    counts[lv] = { すべて: 0, ...Object.fromEntries(themes.map((t) => [t, 0])) }
  }
  for (const s of sentences) {
    const c = counts[s.level]
    if (!c) continue
    c.すべて++
    const t = themeOf.get(s.word)
    if (t && c[t] != null) {
      c[t]++
      themeMap[s.level][s.word] = t
    }
  }
  return { themeMap, counts }
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

// theme.js の中身（遅延 import 専用のマップ）。
export function renderThemeJs(themeMap, levels = LEVELS) {
  const body = levels
    .map((lv) => {
      const entries = Object.entries(themeMap[lv] || {}).sort(([a], [b]) => a.localeCompare(b))
      const inner = entries.map(([w, t]) => `'${esc(w)}': '${esc(t)}'`).join(', ')
      return `  ${lv}: { ${inner} },`
    })
    .join('\n')
  return (
    '// 自動生成（content-build / gen-wsent-theme）。編集しない。見出し語 word → theme のマップ。\n' +
    '// 遅延 import 専用（初回バンドルに含めない）。テーマ付きの語のみを収録する。\n' +
    `export default {\n${body}\n}\n`
  )
}

// wsentCounts.js の中身（level×theme 件数。index.js が re-export する）。
export function renderWsentCountsJs(counts) {
  return (
    '// 自動生成（content-build / gen-wsent-theme）。編集しない。単語例文の level×theme 件数。\n' +
    `export const WSENT_COUNTS = ${JSON.stringify(counts)}\n`
  )
}
