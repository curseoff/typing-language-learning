// 英英辞典データ（スターター24語）。
// word=見出し語 / def=やさしい英語の定義 / ja=定義の和訳 / kana=和訳の読み（日本語入力用）。
// 既存の buildUnits に渡すため en=def として扱う。
import { WORD_LEVELS, WORD_THEMES } from './words.js'

export { WORD_LEVELS as DICT_LEVELS, WORD_THEMES as DICT_THEMES }

// 英英辞典のモード
// quiz＝定義を読んで単語を当てる4択 / pick＝単語に合う説明文を選んで入力
// en＝定義文を打つ / ja＝和訳を打つ
export const DICT_MODES = [
  { key: 'quiz', label: '単語4択' },
  { key: 'pick', label: '説明4択' },
  { key: 'en', label: '英語入力' },
  { key: 'ja', label: '日本語入力' },
]

export const DICT = [
  // ---- L1 基礎 ----
  { word: 'water', def: 'a clear liquid that you drink', ja: '飲む透明な液体', kana: 'のむとうめいなえきたい', level: 1, theme: '日常' },
  { word: 'friend', def: 'a person you like and know well', ja: '好きでよく知っている人', kana: 'すきでよくしっているひと', level: 1, theme: '日常' },
  { word: 'house', def: 'a building where people live', ja: '人が住む建物', kana: 'ひとがすむたてもの', level: 1, theme: '日常' },
  { word: 'book', def: 'pages with words that you read', ja: '読む言葉が書かれた紙', kana: 'よむことばがかかれたかみ', level: 1, theme: '日常' },
  { word: 'dog', def: 'an animal that many people keep at home', ja: '多くの人が家で飼う動物', kana: 'おおくのひとがいえでかうどうぶつ', level: 1, theme: '日常' },
  { word: 'eat', def: 'to put food in your mouth', ja: '食べ物を口に入れる', kana: 'たべものをくちにいれる', level: 1, theme: '日常' },
  { word: 'hotel', def: 'a place where you stay when you travel', ja: '旅行のとき泊まる場所', kana: 'りょこうのときとまるばしょ', level: 1, theme: '旅行' },
  { word: 'map', def: 'a picture that shows where places are', ja: '場所を示す絵', kana: 'ばしょをしめすえ', level: 1, theme: '旅行' },
  { word: 'train', def: 'a vehicle that runs on rails', ja: '線路を走る乗り物', kana: 'せんろをはしるのりもの', level: 1, theme: '旅行' },
  { word: 'sea', def: 'a very large area of salt water', ja: 'とても広い塩水', kana: 'とてもひろいしおみず', level: 1, theme: '旅行' },
  { word: 'work', def: 'a job that you do to get money', ja: 'お金を得るためにする仕事', kana: 'おかねをえるためにするしごと', level: 1, theme: 'ビジネス' },
  { word: 'money', def: 'coins and paper that you use to buy things', ja: '物を買うのに使う硬貨や紙', kana: 'ものをかうのにつかうこうかやかみ', level: 1, theme: 'ビジネス' },

  // ---- L2 初級 ----
  { word: 'kitchen', def: 'a room where you cook food', ja: '料理をする部屋', kana: 'りょうりをするへや', level: 2, theme: '日常' },
  { word: 'weather', def: 'how hot cold or wet it is outside', ja: '外の暑さや寒さの様子', kana: 'そとのあつさやさむさのようす', level: 2, theme: '日常' },
  { word: 'decide', def: 'to choose what you will do', ja: '何をするか選ぶ', kana: 'なにをするかえらぶ', level: 2, theme: '日常' },
  { word: 'breakfast', def: 'the first meal of the day', ja: '一日の最初の食事', kana: 'いちにちのさいしょのしょくじ', level: 2, theme: '日常' },
  { word: 'airport', def: 'a place where planes take off and land', ja: '飛行機が発着する場所', kana: 'ひこうきがはっちゃくするばしょ', level: 2, theme: '旅行' },
  { word: 'ticket', def: 'a small paper that lets you enter or ride', ja: '乗ったり入ったりできる小さな紙', kana: 'のったりはいったりできるちいさなかみ', level: 2, theme: '旅行' },
  { word: 'reserve', def: 'to keep something for later use', ja: '後で使うためにとっておく', kana: 'あとでつかうためにとっておく', level: 2, theme: '旅行' },
  { word: 'meeting', def: 'a time when people talk about work', ja: '仕事について話す時間', kana: 'しごとについてはなすじかん', level: 2, theme: 'ビジネス' },
  { word: 'report', def: 'a paper that tells about something', ja: '何かを伝える書類', kana: 'なにかをつたえるしょるい', level: 2, theme: 'ビジネス' },
  { word: 'salary', def: 'money you get from your job each month', ja: '毎月仕事からもらうお金', kana: 'まいつきしごとからもらうおかね', level: 2, theme: 'ビジネス' },
  { word: 'customer', def: 'a person who buys things from a shop', ja: '店で物を買う人', kana: 'みせでものをかうひと', level: 2, theme: 'ビジネス' },
  { word: 'office', def: 'a place where people work at desks', ja: '机で働く場所', kana: 'つくえではたらくばしょ', level: 2, theme: 'ビジネス' },
]
