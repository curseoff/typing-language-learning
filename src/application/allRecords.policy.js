// 全記録横断ビュー（Issue #248）の集約・ソートロジック（application の純関数）。
// 3リポジトリ（typing-records/dict-records/word-records）の生データ（キー→記録配列）を
// 1本のフラット配列へ正規化し、列キーで並べ替える。infrastructure/React/DOM には依存しない
// （localStorage の load 呼び出しや物語の集約は App 側で行い、正規化済みマップを渡す）。
import { WORD_MODES } from '../content/words.js'
import { DICT_MODES } from '../content/dictionary.js'
import { modeLabel as sentModeLabel } from '../content/modes.js'

// 種類（kind）→日本語ラベル。記録の由来を表す。wsent は結果画面/TOP と揃えた正本「単語例文」（#360）。
const KIND_LABELS = { wsent: '単語例文', story: '物語', words: '単語', dict: '英英' }
// 種類の意味順（文章→物語→単語→英英）。ソートの kind 昇順に使う。
const KIND_ORDER = { wsent: 0, story: 1, words: 2, dict: 3 }

// レベル数値→記録表示用ラベル。結果画面/モーダルの正本に揃え `L{level}`（例 level1→L1）。null は空欄。
// ※これは記録表示（すべての記録の行・rankText）専用。レベル選択チップの WORD_LEVELS.label（基礎/初級…）とは別。
const levelLabelOf = (level) => (level == null ? '' : `L${level}`)

// 種類ごとのモードラベル解決（キーが重なるため kind で辞書を切り替える）。
const wordModeLabel = (key) => WORD_MODES.find((m) => m.key === key)?.label ?? key
const dictModeLabel = (key) => DICT_MODES.find((m) => m.key === key)?.label ?? key
function modeLabelOf(kind, mode) {
  if (mode == null) return ''
  if (kind === 'words') return wordModeLabel(mode)
  if (kind === 'dict') return dictModeLabel(mode)
  return sentModeLabel(mode) // wsent / story は通常モード語彙
}

// 欠損耐性のある数値化（有限数以外は 0）。
const toNum = (v) => (Number.isFinite(v) ? v : 0)

// "YYYY/M/D H:mm:ss"（toLocaleString('ja-JP')）を比較可能な数値へ。失敗時は 0。
function toDateTs(date) {
  if (!date) return 0
  const ts = Date.parse(date)
  return Number.isFinite(ts) ? ts : 0
}

// 1件の生記録を正規化行へ。kind ごとに level/theme の取り出し方が異なる。
function normalize(kind, record) {
  const level =
    kind === 'wsent' ? (record.rank ?? null) : kind === 'story' ? null : (record.level ?? null)
  const theme = kind === 'story' ? null : (record.theme ?? null)
  const mode = record.mode ?? null
  const date = record.date ?? null
  return {
    kind,
    kindLabel: KIND_LABELS[kind] ?? kind,
    level,
    levelLabel: levelLabelOf(level),
    mode,
    modeLabel: modeLabelOf(kind, mode),
    theme,
    speed: toNum(record.speed),
    accuracy: toNum(record.accuracy),
    mistakes: toNum(record.mistakes),
    keys: toNum(record.keys),
    seconds: toNum(record.seconds),
    date,
    dateTs: toDateTs(date),
    // 行クリックで記録詳細へ遷移する用（#250）。元記録・同ランキング配列・順位を保持。
    raw: record,
  }
}

// records マップ（typing-records-v3）内の source から kind を判定。練習モード(touch/romaji)は対象外。
function kindFromRecordsSource(source) {
  if (source === 'touch' || source === 'romaji') return null // 練習モードは記録横断ビュー対象外
  if (source === 'story') return 'story'
  return 'wsent' // 文章（未指定含む）
}

// 各キー配下の記録配列を、kind を付けて out へ展開する共通処理。
// 各行に siblings（同一ランキングキー配下の元記録配列＝list そのもの・参照共有）と
// position（グループ内 1 始まり連番）を付与する（#250: 行クリックで記録詳細へ遷移）。
function pushAll(out, map, kindResolver) {
  for (const list of Object.values(map || {})) {
    if (!Array.isArray(list)) continue
    for (let i = 0; i < list.length; i++) {
      const record = list[i]
      const kind = kindResolver(record)
      if (kind == null) continue // 除外（touch 等）
      // position=index+1（siblings[position-1] が自身の raw と一致する不変条件）。
      out.push({ ...normalize(kind, record), siblings: list, position: i + 1 })
    }
  }
}

// 契約①: 3リポジトリの生データを1本の正規化フラット配列へ（元データ非破壊）。
export function flattenRecords({ records, dictRecords, wordRecords } = {}) {
  const out = []
  pushAll(out, records, (r) => kindFromRecordsSource(r.source))
  pushAll(out, dictRecords, () => 'dict')
  pushAll(out, wordRecords, () => 'words')
  return out
}

// ソートの比較値（数値/文字列/種類順）を key から取り出す。未知 key は null。
function sortValueOf(row, key) {
  switch (key) {
    case 'speed':
    case 'accuracy':
    case 'mistakes':
    case 'keys':
    case 'seconds':
      return row[key]
    case 'date':
      return row.dateTs
    case 'level':
      return row.level == null ? -Infinity : row.level
    case 'kind':
      return KIND_ORDER[row.kind] ?? Number.MAX_SAFE_INTEGER
    case 'mode':
      return row.modeLabel ?? ''
    case 'theme':
      return row.theme ?? ''
    default:
      return null // 未知 key
  }
}

// 契約②: 列キー×昇降で並べ替える純関数（非破壊・安定・未知 key は素通し）。
export function sortAllRecords(list, key, dir = 'asc') {
  const arr = Array.isArray(list) ? list : []
  // 未知 key は入力順のまま複製を返す（安全な素通し）。
  const sample = arr.length ? sortValueOf(arr[0], key) : null
  if (arr.length && sample === null) return arr.slice()
  const sign = dir === 'desc' ? -1 : 1
  const isString = typeof sample === 'string'
  return arr
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const va = sortValueOf(a.row, key)
      const vb = sortValueOf(b.row, key)
      let base
      if (isString) base = String(va).localeCompare(String(vb))
      else base = va < vb ? -1 : va > vb ? 1 : 0
      if (base !== 0) return base * sign
      return a.i - b.i // 同値は入力順を維持（安定）
    })
    .map((x) => x.row)
}
