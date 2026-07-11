// #360 記録詳細（record-detail）に共有 URL を与えるための純関数群。
// - routeFromRawRecord: 生記録＋position → record-detail RouteState（結果ページから URL を組む用）。
// - rowToDetailCtx: 正規化行 → RecordDetail のヘッダー文脈（AllRecordsView.onRowClick の中身を純化）。
// - resolveColdDetail: URL 直開き（cold start）で route から該当記録を探し当てる（全域＝常に throw しない）。
// application 内の allRecords.policy（flattenRecords）と domain の records（endConditionTag）にのみ依存する。
// React/DOM/クロック/ストレージ非依存・決定的・入力非破壊を保つ。
import { flattenRecords } from './allRecords.policy.js'
import { endConditionTag } from '../domain/records/ranking.service.js'
import { DEFAULT_END_CONDITION } from '../content/endConditions.js'

// 記録の source → record-detail の kind。touch/romaji は URL 非対象（null）。
// source 未定義は文章（wsent）扱い（recKey の既定 source と一致）。
const KIND_BY_SOURCE = {
  word: 'words',
  dict: 'dict',
  story: 'story',
  wsent: 'wsent',
  sentence: 'wsent',
}

// source → kind（未対象＝null）。undefined は wsent へ。
function kindOfSource(source) {
  if (source == null) return 'wsent'
  return KIND_BY_SOURCE[source] ?? null
}

// 生記録＋順位 → record-detail RouteState（URL 非対象の source は null）。
// 座標: words/dict=record.level・wsent=record.rank・story=record.storyId。ec は record.endCondition（無ければ既定 time60）。
export function routeFromRawRecord(record, position) {
  if (record == null) return null
  const kind = kindOfSource(record.source)
  if (kind == null) return null // touch/romaji・未知 source
  const endCondition = record.endCondition ?? DEFAULT_END_CONDITION
  if (kind === 'story') {
    return { view: 'record-detail', kind: 'story', storyId: record.storyId, endCondition, position }
  }
  const level = kind === 'wsent' ? record.rank : record.level // wsent は rank が level 座標
  return { view: 'record-detail', kind, level, theme: record.theme, mode: record.mode, endCondition, position }
}

// 正規化行（flattenRecords 出力）→ RecordDetail の open(record, position, ctx) に渡す ctx。
// rankText＝種類＋レベル＋テーマ（物語は種類ラベルのみ）。AllRecordsView.rankTextOf/onRowClick を純化。
export function rowToDetailCtx(row) {
  return {
    rankText: rankTextOf(row),
    modeKey: row.mode,
    list: row.siblings, // 同一ランキング配列そのもの（参照共有＝ページ内の順位切替に使う）
    isQuiz: row.raw?.correct != null, // クイズ系（英日4択）は correct を持つ
    hasEnding: row.kind === 'story', // 物語のみエンディング表示
  }
}

// 行→ランキング見出し。単語/英英/文章＝種類＋レベル＋テーマ（例「単語 基礎 / 旅行」）。物語＝種類名のみ。
function rankTextOf(row) {
  if (row.kind === 'story') return row.kindLabel
  const head = row.levelLabel ? `${row.kindLabel} ${row.levelLabel}` : row.kindLabel
  return row.theme ? `${head} / ${row.theme}` : head
}

// record-detail RouteState → 一致判定キー（kind|座標|ecタグ|position）。record-detail 以外は null。
// 座標は words/dict/wsent=level__theme__mode・story=storyId。ec の異なる同座標ランキングを区別する。
function detailMatchKey(route) {
  if (route == null || route.view !== 'record-detail') return null
  const { kind } = route
  const coord = kind === 'story' ? route.storyId : `${route.level}__${route.theme}__${route.mode}`
  return `${kind}|${coord}|${endConditionTag(route.endCondition)}|${route.position}`
}

// URL 直開きで route から該当記録を探す（全域＝どんな入力でも throw せず、見つからなければ null）。
// maps={records,dictRecords,wordRecords,storyRecords}。AllRecordsView と同じく物語を records マップへ束ね、
// flattenRecords で全 row を作り、(kind, 座標, ec, position) が一致する row の raw/position/ctx を返す。
export function resolveColdDetail(route, maps) {
  const target = detailMatchKey(route)
  if (target == null) return null // record-detail でない・null route
  const { records, dictRecords, wordRecords, storyRecords } = maps || {}
  // 物語記録（storyId・ec 別バリアント）を records マップ形へ束ねる（キー衝突回避に接頭辞）。
  const combined = { ...(records || {}) }
  for (const [key, list] of Object.entries(storyRecords || {})) {
    combined[`story-${key}`] = list
  }
  const rows = flattenRecords({ records: combined, dictRecords, wordRecords })
  for (const row of rows) {
    const candidate = routeFromRawRecord(row.raw, row.position)
    if (candidate == null) continue
    if (detailMatchKey(candidate) === target) {
      return { record: row.raw, position: row.position, ctx: rowToDetailCtx(row) }
    }
  }
  return null // 該当なし・range 外
}
