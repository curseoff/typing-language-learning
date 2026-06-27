// タッチタイピング練習用のキーボード配列・指の割り当て・レベル定義。
// 表示は JIS 日本語キーボード（実機）を参照に刻印・段差・キー間ギャップを作り込む。

// 表示するキーボード（数字段 / 上段 / ホーム段 / 下段）。
// 各行は実機の JIS 配列に合わせ、右側の記号キーまで含める。
// 打鍵判定の対象になるのは英数字キー（drill が KEY_ROWS から拾う英字キー）。
// 右側の追加記号キーは表示専用（刻印・段差の見た目を実機に近づける加飾）。
export const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '^', '¥'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '@', '['],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', ':', ']'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '_'],
]

// JIS 刻印（参照画像どおり）。
//   main  … 主たる英字／数字（キー左上に大きめ）
//   kana  … JIS かな（右下、カタカナ。小書きは「小」の添字で表現せず文字そのまま）
//   shift … シフト時に入る記号（数字段・記号キーの上段に小さく）
// 打鍵判定はキーの id（KEY_ROWS の要素）でのみ行い、この刻印は表示専用。
export const KEY_LEGENDS = {
  // 数字段：数字 + シフト記号 + JIS かな
  1: { kana: 'ヌ', shift: '!' },
  2: { kana: 'フ', shift: '"' },
  3: { kana: 'ア', shift: '#', kanaSmall: 'ァ' },
  4: { kana: 'ウ', shift: '$', kanaSmall: 'ゥ' },
  5: { kana: 'エ', shift: '%', kanaSmall: 'ェ' },
  6: { kana: 'オ', shift: '&', kanaSmall: 'ォ' },
  7: { kana: 'ヤ', shift: "'", kanaSmall: 'ャ' },
  8: { kana: 'ユ', shift: '(', kanaSmall: 'ュ' },
  9: { kana: 'ヨ', shift: ')', kanaSmall: 'ョ' },
  0: { kana: 'ワ', shift: '', kanaSmall: 'ヲ' },
  '-': { kana: 'ホ', shift: '=' },
  '^': { kana: 'ヘ', shift: '~' },
  '¥': { kana: 'ー', shift: '|' },
  // 上段
  q: { kana: 'タ' },
  w: { kana: 'テ' },
  e: { kana: 'イ', kanaSmall: 'ィ' },
  r: { kana: 'ス' },
  t: { kana: 'カ' },
  y: { kana: 'ン' },
  u: { kana: 'ナ' },
  i: { kana: 'ニ' },
  o: { kana: 'ラ' },
  p: { kana: 'セ' },
  '@': { kana: '゛', shift: '`' },
  '[': { kana: '゜', shift: '{' },
  // ホーム段
  a: { kana: 'チ' },
  s: { kana: 'ト' },
  d: { kana: 'シ' },
  f: { kana: 'ハ' },
  g: { kana: 'キ' },
  h: { kana: 'ク' },
  j: { kana: 'マ' },
  k: { kana: 'ノ' },
  l: { kana: 'リ' },
  ';': { kana: 'レ', shift: '+' },
  ':': { kana: 'ケ', shift: '*' },
  ']': { kana: 'ム', shift: '}' },
  // 下段
  z: { kana: 'ツ', kanaSmall: 'ッ' },
  x: { kana: 'サ' },
  c: { kana: 'ソ' },
  v: { kana: 'ヒ' },
  b: { kana: 'コ' },
  n: { kana: 'ミ' },
  m: { kana: 'モ' },
  ',': { kana: 'ネ', shift: '<' },
  '.': { kana: 'ル', shift: '>' },
  '/': { kana: 'メ', shift: '?', kanaSmall: '・' },
  _: { kana: 'ロ', shift: '' },
}

// 各行の左端オフセット（スタガード＝段差）。実機 JIS の段差に寄せる（単位 px）。
// 数字段が最左、Q段が少し右、A段がさらに右、Z段がもっと右。
export const ROW_OFFSET = [0, 22, 33, 55]

// 表示専用キー（打鍵対象にしない＝drill / FINGER の判定対象外。色と刻印だけ持つ）。
export const DISPLAY_ONLY_KEYS = ['-', '^', '¥', '@', '[', ':', ']', '_']

// 各キーを担当する指（色分け・案内用）。lp/lr/lm/li/ri/rm/rr/rp
// 右側の追加記号キーは標準運指で右小指（rp）に割り当てる。
export const FINGER = {
  1: 'lp', q: 'lp', a: 'lp', z: 'lp',
  2: 'lr', w: 'lr', s: 'lr', x: 'lr',
  3: 'lm', e: 'lm', d: 'lm', c: 'lm',
  4: 'li', 5: 'li', r: 'li', t: 'li', f: 'li', g: 'li', v: 'li', b: 'li',
  6: 'ri', 7: 'ri', y: 'ri', u: 'ri', h: 'ri', j: 'ri', n: 'ri', m: 'ri',
  8: 'rm', i: 'rm', k: 'rm', ',': 'rm',
  9: 'rr', o: 'rr', l: 'rr', '.': 'rr',
  0: 'rp', p: 'rp', ';': 'rp', '/': 'rp',
  // 右側の追加記号キー（すべて右小指）
  '-': 'rp', '^': 'rp', '¥': 'rp', '@': 'rp', '[': 'rp', ':': 'rp', ']': 'rp', _: 'rp',
}

export const FINGER_LABEL = {
  lp: '左 小指',
  lr: '左 薬指',
  lm: '左 中指',
  li: '左 人差し指',
  ri: '右 人差し指',
  rm: '右 中指',
  rr: '右 薬指',
  rp: '右 小指',
}

// ホームポジション（印を付ける）
export const HOME_KEYS = ['a', 's', 'd', 'f', 'j', 'k', 'l', ';']

// F/J の突起（実機のホームポジション・バー）を中黒「・」で表すキー
export const BUMP_KEYS = ['f', 'j']

// 練習レベル（打鍵対象のキー集合）
export const TOUCH_LEVELS = [
  { key: 'home', label: 'ホームポジション', keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'] },
  { key: 'top', label: '上段', keys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'] },
  { key: 'bottom', label: '下段', keys: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'] },
  { key: 'number', label: '数字', keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] },
  {
    key: 'all',
    label: 'すべて',
    keys: [
      'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
      'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';',
      'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/',
    ],
  },
]
