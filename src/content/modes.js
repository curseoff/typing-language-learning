// 入力モードの定義（通常入力 / 翻訳）。
export const MODES = [
  { key: 'both', label: '英語・日本語', group: '通常入力' },
  { key: 'en', label: '英語', group: '通常入力' },
  { key: 'ja', label: '日本語', group: '通常入力' },
  { key: 'en-tr', label: '英語訳', group: '翻訳' },
  { key: 'ja-tr', label: '日本語訳', group: '翻訳' },
]

export function modeLabel(key) {
  return MODES.find((m) => m.key === key)?.label ?? key
}

export function modeDesc(key) {
  switch (key) {
    case 'en':
      return '英文だけを連続で入力します。'
    case 'ja':
      return '和文だけをローマ字で連続入力します。'
    case 'en-tr':
      return '和文を見て英語に翻訳。単語チップがヒント。入力は伏せられ、正しく打つと現れます。'
    case 'ja-tr':
      return '英文を見て日本語(ローマ字)に翻訳。単語チップがヒント。入力は伏せられ、正しく打つと現れます。'
    default:
      return '英文と和文を交互に入力します。'
  }
}
