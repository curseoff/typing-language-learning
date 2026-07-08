// ローマ字入力練習モードのレベル定義（出題対象＝かな五十音表の行グループ）。
// 各レベルは @tll/core の KANA_TABLE の行 id 群（rowIds）を持ち、kanaOf(rowIds) で出題かなに展開する。
// 表データ（かな・ローマ字）の正本は KANA_TABLE 側＝ここは「どの行を練習するか」だけを持つ。
import { KANA_TABLE } from '@tll/core'

// 練習モードは当面 1 種（ガイド常時表示）。記録キー（recKey）のモード軸として使う。
export const ROMAJI_MODE = 'normal'

export const ROMAJI_LEVELS = [
  { key: 'a', label: 'あ行', rowIds: ['a'] },
  { key: 'ka', label: 'か行', rowIds: ['ka'] },
  { key: 'sa', label: 'さ行', rowIds: ['sa'] },
  { key: 'ta', label: 'た行', rowIds: ['ta'] },
  { key: 'na', label: 'な行', rowIds: ['na'] },
  { key: 'ha', label: 'は行', rowIds: ['ha'] },
  { key: 'ma', label: 'ま行', rowIds: ['ma'] },
  { key: 'ya', label: 'や行', rowIds: ['ya'] },
  { key: 'ra', label: 'ら行', rowIds: ['ra'] },
  { key: 'wa', label: 'わ行・ん', rowIds: ['wa', 'n'] },
  { key: 'daku', label: '濁音', rowIds: ['ga', 'za', 'da', 'ba'] },
  { key: 'handaku', label: '半濁音', rowIds: ['pa'] },
  {
    key: 'youon',
    label: '拗音',
    rowIds: ['kya', 'gya', 'sha', 'ja', 'cha', 'nya', 'hya', 'bya', 'pya', 'mya', 'rya'],
  },
  // ぜんぶ＝表の全行ミックス（行の追加に自動追従するよう KANA_TABLE から導出）。
  { key: 'all', label: 'ぜんぶ', rowIds: KANA_TABLE.map((r) => r.id) },
]
