// Keyboard 表示が使う静的なキーレイアウト設定（純粋な UI 設定なので @tll/ui に co-locate）。
// 表示は JIS 日本語キーボード（実機）を参照に刻印・段差・キー間ギャップを作り込む。
// ※ TOUCH_LEVELS/TOUCH_MODES（出題・練習レベル）は TouchSection/drill 側の関心なので
//    ここには置かず content/keyboard.js に残す。

export type Finger = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp'

export interface KeyLegend {
  main?: string
  kana?: string
  kanaSmall?: string
  shift?: string
  mainTop?: boolean
}

// 表示するキーボード（数字段 / 上段 / ホーム段 / 下段）。
export const KEY_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '^', '¥'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '@', '['],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', ':', ']'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '_'],
]

// JIS 刻印（参照画像どおり）。main=英字/数字、kana=JISかな、shift=シフト記号、kanaSmall=小書きかな。
export const KEY_LEGENDS: Record<string, KeyLegend> = {
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
export const ROW_OFFSET: number[] = [0, 22, 33, 55]

// 表示専用キー（打鍵対象にしない＝色と刻印だけ持つ）。
export const DISPLAY_ONLY_KEYS: string[] = ['-', '^', '¥', '@', '[', ':', ']', '_']

// 各キーを担当する指（色分け・案内用）。lp/lr/lm/li/ri/rm/rr/rp
export const FINGER: Record<string, Finger> = {
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

// ホームポジション（印を付ける）
export const HOME_KEYS: string[] = ['a', 's', 'd', 'f', 'j', 'k', 'l', ';']

// F/J の突起（実機のホームポジション・バー）を中黒「・」で表すキー
export const BUMP_KEYS: string[] = ['f', 'j']
