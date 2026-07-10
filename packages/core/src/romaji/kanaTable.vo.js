// かな五十音表データ（ローマ字入力練習モード用）。
// 表示ローマ字は toRomaji から導出し、ハードコードしない（romaji.js と単一の正本に保つ）。
// v1 スコープ＝清音/濁音/半濁音/拗音のみ。特殊拗音（外来音: ふぁ/てぃ/ゔ 等）は含めない。
import { toRomaji } from './romaji.service.js'

const N = null

// [id, group, label, kana列（欠けは null）] の宣言。cell は toRomaji で導出する。
const SPECS = [
  ['a', 'sei', 'あ行', ['あ', 'い', 'う', 'え', 'お']],
  ['ka', 'sei', 'か行', ['か', 'き', 'く', 'け', 'こ']],
  ['sa', 'sei', 'さ行', ['さ', 'し', 'す', 'せ', 'そ']],
  ['ta', 'sei', 'た行', ['た', 'ち', 'つ', 'て', 'と']],
  ['na', 'sei', 'な行', ['な', 'に', 'ぬ', 'ね', 'の']],
  ['ha', 'sei', 'は行', ['は', 'ひ', 'ふ', 'へ', 'ほ']],
  ['ma', 'sei', 'ま行', ['ま', 'み', 'む', 'め', 'も']],
  ['ya', 'sei', 'や行', ['や', N, 'ゆ', N, 'よ']],
  ['ra', 'sei', 'ら行', ['ら', 'り', 'る', 'れ', 'ろ']],
  ['wa', 'sei', 'わ行', ['わ', N, N, N, 'を']],
  ['n', 'sei', 'ん', ['ん']],
  ['ga', 'daku', 'が行', ['が', 'ぎ', 'ぐ', 'げ', 'ご']],
  ['za', 'daku', 'ざ行', ['ざ', 'じ', 'ず', 'ぜ', 'ぞ']],
  ['da', 'daku', 'だ行', ['だ', 'ぢ', 'づ', 'で', 'ど']],
  ['ba', 'daku', 'ば行', ['ば', 'び', 'ぶ', 'べ', 'ぼ']],
  ['pa', 'handaku', 'ぱ行', ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']],
  ['kya', 'youon', 'きゃ行', ['きゃ', 'きゅ', 'きょ']],
  ['gya', 'youon', 'ぎゃ行', ['ぎゃ', 'ぎゅ', 'ぎょ']],
  ['sha', 'youon', 'しゃ行', ['しゃ', 'しゅ', 'しょ']],
  ['ja', 'youon', 'じゃ行', ['じゃ', 'じゅ', 'じょ']],
  ['cha', 'youon', 'ちゃ行', ['ちゃ', 'ちゅ', 'ちょ']],
  ['nya', 'youon', 'にゃ行', ['にゃ', 'にゅ', 'にょ']],
  ['hya', 'youon', 'ひゃ行', ['ひゃ', 'ひゅ', 'ひょ']],
  ['bya', 'youon', 'びゃ行', ['びゃ', 'びゅ', 'びょ']],
  ['pya', 'youon', 'ぴゃ行', ['ぴゃ', 'ぴゅ', 'ぴょ']],
  ['mya', 'youon', 'みゃ行', ['みゃ', 'みゅ', 'みょ']],
  ['rya', 'youon', 'りゃ行', ['りゃ', 'りゅ', 'りょ']],
]

const toCell = (kana) => (kana == null ? null : Object.freeze({ kana, romaji: toRomaji(kana) }))

export const KANA_TABLE = Object.freeze(
  SPECS.map(([id, group, label, kanas]) =>
    Object.freeze({ id, group, label, cells: Object.freeze(kanas.map(toCell)) }),
  ),
)

// かな → { rowId, col } の逆引き表（module ロード時に一度だけ構築）。
const CELL_INDEX = new Map()
for (const row of KANA_TABLE) {
  row.cells.forEach((cell, col) => {
    if (cell) CELL_INDEX.set(cell.kana, { rowId: row.id, col })
  })
}

// 行 id 群 → かなを row-major・null 除外で平坦化する。
export function kanaOf(rowIds) {
  const out = []
  for (const id of rowIds) {
    const row = KANA_TABLE.find((r) => r.id === id)
    if (!row) continue
    for (const cell of row.cells) if (cell) out.push(cell.kana)
  }
  return out
}

// かな → { rowId, col }。表に無ければ null（特殊拗音もスコープ外＝null）。
export function cellOf(kana) {
  return CELL_INDEX.get(kana) ?? null
}
