// 復習(SRS)のデッキ定義。デッキごとに「手がかり(prompt)→打つ答え(answer)」と id 接頭辞が異なる。
// いずれも答えは英単語(en)で、別の手がかりから同じ語を産出想起する。
// loadContent は遅延 import（呼び出し側で実行）。
import { loadWords } from '../content/words.js'
import { loadDict } from '../content/dictionary.js'
import { loadAllWsent } from '../content/wordSentences/index.js'

export const DECKS = {
  words: {
    key: 'words',
    prefix: 'w:',
    label: '単語',
    dir: '意味（和訳）から英単語を入力',
    loadContent: loadWords,
    id: (it) => `w:${it.en}`,
    answer: (it) => it.en,
    prompt: (it) => it.ja,
    // 頻度順に新規を導入
    order: (items) => [...items].sort((a, b) => (a.freq ?? 1e9) - (b.freq ?? 1e9)),
  },
  dict: {
    key: 'dict',
    prefix: 'd:',
    label: '英英辞典',
    dir: 'やさしい英語の定義から見出し語を入力',
    loadContent: loadDict,
    id: (it) => `d:${it.word}`,
    answer: (it) => it.word,
    prompt: (it) => it.def,
    order: (items) => items, // レベル順（頻度帯順）
  },
  wsent: {
    key: 'wsent',
    prefix: 's:',
    label: '単語例文',
    dir: '和文の例文で使われている英単語を入力',
    loadContent: loadAllWsent,
    id: (it) => `s:${it.word}`,
    answer: (it) => it.word,
    prompt: (it) => it.ja,
    order: (items) => items, // レベル順
  },
}

export const DECK_KEYS = Object.keys(DECKS)
