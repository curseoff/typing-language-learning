// 復習の「想起後に例文を見せる」用。単語(en) → 例文 {en, ja} の Map を遅延構築しキャッシュする。
// 例文(約6MB)を読むのでセッション中は背景で読み込み、間に合った分だけ表示する。
import { loadAllWsent } from '../content/wordSentences/index.js'

let cache = null

export function loadExampleMap() {
  if (!cache) {
    cache = loadAllWsent().then((sents) => {
      const m = new Map()
      for (const s of sents) if (!m.has(s.word)) m.set(s.word, { en: s.en, ja: s.ja })
      return m
    })
  }
  return cache
}
