// #390: 単語例文の「テーマ絞り」を domain の純関数へ集約する。
// 例文は theme を直接持たず、見出し語 word → theme の themeMap で絞る
// （words/dict と異なり、例文側は theme を持たないため）。
export function filterWsentByTheme(pool, theme, themeMap) {
  return theme === 'すべて' ? pool : pool.filter((s) => themeMap[s.word] === theme)
}
