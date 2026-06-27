// 英英辞典の定数とメタ情報（語義データ本体は遅延 import）。
// word=見出し語 / def=やさしい英語の定義 / ja=定義の和訳 / kana=和訳の読み（日本語入力用）。
// 既存の buildUnits に渡すため en=def として扱う。
import { WORD_LEVELS, WORD_THEMES } from './words.js'

export { WORD_LEVELS as DICT_LEVELS, WORD_THEMES as DICT_THEMES }

// 英英辞典のモード
// quiz＝定義を読んで単語を当てる4択 / pick＝単語に合う説明文を選んで入力
// en＝定義文を打つ / ja＝和訳を打つ
// 並び順は TOP のモード表示・←→操作と一致させる（入力 → 4択）。
export const DICT_MODES = [
  { key: 'both', label: '英語・日本語' },
  { key: 'en', label: '英語' },
  { key: 'ja', label: '日本語' },
  { key: 'quiz', label: '単語4択' },
  { key: 'pick', label: '説明4択' },
]

// 英英データは大きいので遅延 import（初回バンドルに含めない）。
// アプリ側は loadDict()／DICT_COUNTS／DICT_AVAILABLE_LEVELS を使う。Node ツールは ./dictionaryAll.js を使う。
// DICT_COUNTS/DICT_AVAILABLE_LEVELS はビルド時に算出した値を静的に埋め込む（dictionaryData.js を import しない）。
export const DICT_COUNTS = {"1":{"すべて":728,"日常":632,"旅行":59,"ビジネス":37},"2":{"すべて":1854,"日常":1538,"旅行":111,"ビジネス":205},"3":{"すべて":1286,"日常":1045,"旅行":110,"ビジネス":131},"4":{"すべて":3252,"日常":2811,"旅行":167,"ビジネス":274}}
export const DICT_AVAILABLE_LEVELS = [1,2,3,4]
export const loadDict = () => import('./dictionaryData.js').then((m) => m.default)
