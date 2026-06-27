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
//   kana  … JIS かな（右下、ひらがな。小書きはそのまま）
//   shift … シフト時に入る記号（数字段・記号キーの上段に小さく）
// 打鍵判定はキーの id（KEY_ROWS の要素）でのみ行い、この刻印は表示専用。
export const KEY_LEGENDS = {
  // 数字段：数字 + シフト記号 + JIS かな
  1: { kana: 'ぬ', shift: '!' },
  2: { kana: 'ふ', shift: '"' },
  3: { kana: 'あ', shift: '#', kanaSmall: 'ぁ' },
  4: { kana: 'う', shift: '$', kanaSmall: 'ぅ' },
  5: { kana: 'え', shift: '%', kanaSmall: 'ぇ' },
  6: { kana: 'お', shift: '&', kanaSmall: 'ぉ' },
  7: { kana: 'や', shift: "'", kanaSmall: 'ゃ' },
  8: { kana: 'ゆ', shift: '(', kanaSmall: 'ゅ' },
  9: { kana: 'よ', shift: ')', kanaSmall: 'ょ' },
  0: { kana: 'わ', shift: '', kanaSmall: 'を' },
  '-': { kana: 'ほ', shift: '=' },
  '^': { kana: 'へ', shift: '~' },
  '¥': { kana: 'ー', shift: '|' },
  // 上段
  q: { kana: 'た' },
  w: { kana: 'て' },
  e: { kana: 'い', kanaSmall: 'ぃ' },
  r: { kana: 'す' },
  t: { kana: 'か' },
  y: { kana: 'ん' },
  u: { kana: 'な' },
  i: { kana: 'に' },
  o: { kana: 'ら' },
  p: { kana: 'せ' },
  '@': { kana: '゛', shift: '`' },
  '[': { kana: '゜', shift: '{', kanaSmall: '「' },
  // ホーム段
  a: { kana: 'ち' },
  s: { kana: 'と' },
  d: { kana: 'し' },
  f: { kana: 'は' },
  g: { kana: 'き' },
  h: { kana: 'く' },
  j: { kana: 'ま' },
  k: { kana: 'の' },
  l: { kana: 'り' },
  ';': { kana: 'れ', shift: '+' },
  ':': { kana: 'け', shift: '*' },
  ']': { kana: 'む', shift: '}', kanaSmall: '」' },
  // 下段
  z: { kana: 'つ', kanaSmall: 'っ' },
  x: { kana: 'さ' },
  c: { kana: 'そ' },
  v: { kana: 'ひ' },
  b: { kana: 'こ' },
  n: { kana: 'み' },
  m: { kana: 'も' },
  ',': { kana: 'ね', shift: '<', kanaSmall: '、' },
  '.': { kana: 'る', shift: '>', kanaSmall: '。' },
  '/': { kana: 'め', shift: '?', kanaSmall: '・' },
  _: { kana: 'ろ', shift: '', mainTop: true },
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
