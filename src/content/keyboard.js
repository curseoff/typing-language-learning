// タッチタイピング練習用のキーボード配列・指の割り当て・レベル定義。

// 表示するキーボード（数字段 / 上段 / ホーム段 / 下段）
export const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
]

// 各キーを担当する指（色分け・案内用）。lp/lr/lm/li/ri/rm/rr/rp
export const FINGER = {
  1: 'lp', q: 'lp', a: 'lp', z: 'lp',
  2: 'lr', w: 'lr', s: 'lr', x: 'lr',
  3: 'lm', e: 'lm', d: 'lm', c: 'lm',
  4: 'li', 5: 'li', r: 'li', t: 'li', f: 'li', g: 'li', v: 'li', b: 'li',
  6: 'ri', 7: 'ri', y: 'ri', u: 'ri', h: 'ri', j: 'ri', n: 'ri', m: 'ri',
  8: 'rm', i: 'rm', k: 'rm', ',': 'rm',
  9: 'rr', o: 'rr', l: 'rr', '.': 'rr',
  0: 'rp', p: 'rp', ';': 'rp', '/': 'rp',
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
