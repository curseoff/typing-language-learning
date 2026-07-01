// 単語問題データ（頻度帯 level × テーマ theme[任意]）。
// en=英単語 / ja=和訳 / kana=和訳の読み（日本語入力用）/ freq=頻度ランク(目安) / theme=任意。
// level は freq の頻度帯（bandOf）と一致させる。
export const WORD_LEVELS = [
  { level: 1, label: '基礎', cefr: 'A1', range: '1–1,000' },
  { level: 2, label: '初級', cefr: 'A2', range: '1,001–2,000' },
  { level: 3, label: '中級', cefr: 'B1', range: '2,001–3,000' },
  { level: 4, label: '上級', cefr: 'B2–C1', range: '3,001–5,000' },
]

// 頻度ランク → レベル（頻度帯）。5,000超は最上位帯へ。
const BAND_MAX = [1000, 2000, 3000, 5000]
export function bandOf(freq) {
  for (let i = 0; i < BAND_MAX.length; i++) if (freq <= BAND_MAX[i]) return i + 1
  return WORD_LEVELS.length
}

export const WORD_THEMES = ['日常', '旅行', 'ビジネス']

// 単語モード（英語・日本語/英語/日本語=入力、英語訳/日本語訳=4択クイズ）
export const WORD_MODES = [
  { key: 'both', label: '英語・日本語' },
  { key: 'en', label: '英語' },
  { key: 'ja', label: '日本語' },
  { key: 'quiz-en', label: '英語訳' },
  { key: 'quiz-ja', label: '日本語訳' },
]

// 単語データは大きい(約1.6MB)ので遅延 import（初回バンドルに含めない）。
// アプリ側は loadWords()／WORD_COUNTS を使う。Node ツールは ./wordsAll.js を使う。
export const WORD_COUNTS = {"1":{"すべて":749,"日常":220,"旅行":65,"ビジネス":40},"2":{"すべて":1873,"日常":295,"旅行":114,"ビジネス":191},"3":{"すべて":1307,"日常":175,"旅行":86,"ビジネス":103},"4":{"すべて":15145,"日常":304,"旅行":176,"ビジネス":473}}
// content.sqlite3（SQLite-WASM）から読む。失敗時は生成物 .js にフォールバック。
export const loadWords = async () => {
  try {
    return await (await import('./contentDb.js')).queryWords()
  } catch (e) {
    console.warn('[content] words の SQLite 読込に失敗→.js にフォールバック', e)
    return (await import('./wordsData.js')).default
  }
}

// 単語の英→和グロッサリ（{ [en]: ja }）。SQLite 優先・.js フォールバック。
export const loadWordGloss = async () => {
  try {
    return await (await import('./contentDb.js')).queryGloss()
  } catch (e) {
    console.warn('[content] gloss の SQLite 読込に失敗→.js にフォールバック', e)
    return (await import('./wordGlossData.js')).default
  }
}
