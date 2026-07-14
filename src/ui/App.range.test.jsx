// @vitest-environment jsdom
// #364 英英・単語例文の固定範囲プレイ開始の App 配線テスト。range 選択中に開始すると、App が
// 単語データを遅延ロードして freq 結合し（freqMap／範囲スライス）、該当モードへ遷移することを確認する
// （startDict/startWsent の range 分岐＝location/history 配線とは別の「データ結合＆開始」経路）。
//
// #396 実データ（dictionaryData.js 4.2MB・wordsData.js 1.6MB 等）を実 import すると、jsdom で
// SQLite が使えず巨大生成物の動的 import へフォールバックし、CI の coverage 計装＋並列下で稀に
// タイムアウト（フレーキー）した。ここでは startDict/startWsent が呼ぶローダ関数だけを小さな
// フィクスチャへ vi.mock でスタブし、決定的かつ高速にする（定数は importActual で実物を維持）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor, within, act } from '@testing-library/react'
import App from '../App.jsx'
import { initMemoryPersistence } from '../application/records.service.js'

// --- フィクスチャ（実データ1件でスキーマを突き合わせた最小データ）---------------------------
// 見出し語は互いに前方一致しない語を選ぶ（makeDictQuiz が誤答選択肢の前方一致を除外するため、
// 4択を成立させるには非前方一致の語が4つ以上必要）。level=1・theme=日常 のみで構成する。
const fx = vi.hoisted(() => {
  const HEADWORDS = ['water', 'friend', 'house', 'garden', 'ocean']

  // loadWords(1) の返り値形＝{en, ja, kana, level, theme, freq}（wordsData.js 実データに準拠。
  // 例: {"en":"water","ja":"水","kana":"みず","level":1,"theme":"日常"}）。
  // freq は headwordFreqMap(w.freq) が読む見出し語 freq 索引の値。freq 順で range スライスが決定的になる。
  const WORDS = [
    { en: 'water', ja: '水', kana: 'みず', level: 1, theme: '日常', freq: 1 },
    { en: 'friend', ja: '友達', kana: 'ともだち', level: 1, theme: '日常', freq: 2 },
    { en: 'house', ja: '家', kana: 'いえ', level: 1, theme: '日常', freq: 3 },
    { en: 'garden', ja: '庭', kana: 'にわ', level: 1, theme: '日常', freq: 4 },
    { en: 'ocean', ja: '海', kana: 'うみ', level: 1, theme: '日常', freq: 5 },
  ]

  // loadDict(1) の返り値形＝{word, def, ja, kana, level, theme}（dictionaryData.js 実データに準拠。
  // 例: {"word":"above","def":"in a higher place than something else","ja":"…","kana":"…","level":1,"theme":"日常"}）。
  // def は互いに前方一致しない英小文字＋空白の説明文。buildDictSet の range スライス対象。
  const DICT = [
    { word: 'water', def: 'a clear liquid that people drink', ja: '人が飲む透明な液体', kana: 'ひとがのむとうめいなえきたい', level: 1, theme: '日常' },
    { word: 'friend', def: 'a person you like and trust', ja: '好きで信頼する人', kana: 'すきでしんらいするひと', level: 1, theme: '日常' },
    { word: 'house', def: 'a building where a family lives', ja: '家族が住む建物', kana: 'かぞくがすむたてもの', level: 1, theme: '日常' },
    { word: 'garden', def: 'an area where plants and flowers grow', ja: '植物や花が育つ場所', kana: 'しょくぶつやはながそだつばしょ', level: 1, theme: '日常' },
    { word: 'ocean', def: 'a very large area of salt water', ja: 'とても広い塩水の場所', kana: 'とてもひろいえんすいのばしょ', level: 1, theme: '日常' },
  ]

  // loadWsentLevel(1) の返り値形＝{en, word, ja, kana, level, jaWords}（L1.js 実データに準拠。
  // 例: {"en":"The clouds are above the mountain.","word":"above","ja":"…","kana":"…","level":1,"jaWords":[…]}）。
  // both モードは en（英文）と kana（→ローマ字）を打つので kana は有効なひらがなにする。
  const WSENT = [
    { en: 'I drink water every morning.', word: 'water', ja: '私は毎朝水を飲みます。', kana: 'わたしはまいあさみずをのみます。', level: 1, jaWords: ['私', 'は', '毎朝', '水', 'を', '飲み', 'ます'] },
    { en: 'She is a good friend.', word: 'friend', ja: '彼女は良い友達です。', kana: 'かのじょはよいともだちです。', level: 1, jaWords: ['彼女', 'は', '良い', '友達', 'です'] },
    { en: 'They live in a big house.', word: 'house', ja: '彼らは大きな家に住みます。', kana: 'かれらはおおきないえにすみます。', level: 1, jaWords: ['彼ら', 'は', '大きな', '家', 'に', '住み', 'ます'] },
    { en: 'The garden is full of flowers.', word: 'garden', ja: '庭は花でいっぱいです。', kana: 'にわははなでいっぱいです。', level: 1, jaWords: ['庭', 'は', '花', 'で', 'いっぱい', 'です'] },
    { en: 'The ocean is very deep.', word: 'ocean', ja: '海はとても深いです。', kana: 'うみはとてもふかいです。', level: 1, jaWords: ['海', 'は', 'とても', '深い', 'です'] },
  ]

  // loadWsentThemes() の返り値形＝{ [level]: { [word]: theme } }（theme.js 実データに準拠）。
  // filterWsentByTheme が themeMap[s.word]==='日常' で例文を絞るため、全見出し語を日常にする。
  const THEMES = { 1: Object.fromEntries(HEADWORDS.map((w) => [w, '日常'])) }

  // loadWordGloss() の返り値形＝{ [en]: ja }（wordGlossData.js 実データに準拠）。
  const GLOSS = Object.fromEntries(WORDS.map((w) => [w.en, w.ja]))

  // loadWordRuby() の返り値形＝{ [en]: {ja, kana} }（wordRubyData.js 実データに準拠）。
  const RUBY = Object.fromEntries(WORDS.map((w) => [w.en, { ja: w.ja, kana: w.kana }]))

  return { WORDS, DICT, WSENT, THEMES, GLOSS, RUBY }
})

// 重いローダ関数だけ差し替え、App が import する定数（WORD_*/DICT_*/WSENT_* 等）は実物を維持する。
// これにより巨大生成物（*Data.js）の動的 import 経路を通らず、決定的かつ高速になる。
vi.mock('../content/words.js', async () => {
  const actual = await vi.importActual('../content/words.js')
  return {
    ...actual,
    loadWords: vi.fn(async () => fx.WORDS),
    loadWordGloss: vi.fn(async () => fx.GLOSS),
    loadWordRuby: vi.fn(async () => fx.RUBY),
  }
})
vi.mock('../content/dictionary.js', async () => {
  const actual = await vi.importActual('../content/dictionary.js')
  return { ...actual, loadDict: vi.fn(async () => fx.DICT) }
})
vi.mock('../content/wordSentences/index.js', async () => {
  const actual = await vi.importActual('../content/wordSentences/index.js')
  return {
    ...actual,
    loadWsentLevel: vi.fn(async () => fx.WSENT),
    loadWsentThemes: vi.fn(async () => fx.THEMES),
  }
})

const setPath = (p) => window.history.replaceState(null, '', p)
const pressEnter = () =>
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })))

describe('App 固定範囲プレイ開始 (#364)', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    initMemoryPersistence()
    setPath('/')
  })
  afterEach(() => {
    cleanup()
    setPath('/')
  })

  it('英英を範囲指定して開始すると英英プレイ画面へ遷移する（freqMap 結合経路）', async () => {
    setPath('/dict/1/日常/quiz/r1')
    const { container } = render(<App />)
    expect(selectedTab(container, '英英辞典')).toMatch(/sel/)
    pressEnter() // start → startDict(dictRange=1)＝単語(level1)をロードし freqMap を作る
    // ready(type-tabs) が消え、英英プレイの4択が出る（スタブローダ即解決）。
    await waitFor(() => expect(container.querySelector('.type-tabs')).toBeNull())
  })

  it('単語例文を範囲指定して開始すると例文プレイ画面へ遷移する（freq 順スライス経路）', async () => {
    setPath('/sentences/1/日常/both/r1')
    const { container } = render(<App />)
    expect(selectedTab(container, '単語例文')).toMatch(/sel/)
    pressEnter() // start → startWsent(wsentRange=1)＝単語(level1)をロードし freq 順にスライス
    await waitFor(() => expect(container.querySelector('.type-tabs')).toBeNull())
  })
})

// 種類タブの選択状態クラスを取り出す（App.routing.test と同じ流儀）。
function selectedTab(container, label) {
  return within(container.querySelector('.type-tabs')).getByText(label).closest('.type-tab').className
}
