// #451 記録の1件削除：生記録 1 件から「記録メモリ像のどの store のどの key の配列にいるか」を導く。
// 削除は座標（store/key）が分からないと始まらない。routeFromRawRecord（application）が
// 「記録単体から画面座標を導ける」ことを示しているのと同じ考え方を、キー座標に対して行う。
// キー文字列はここで組み立てず既存のキー関数へ委譲する（保存側とキーがずれると削除が空振りするため）。
import { recKey } from './ranking.service.js'
import { wordRecKey, dictRecKey, storyRecKey } from './recordKeys.service.js'

// 座標が 1 つも無ければキーを作らない（"undefined__rundefined" のような幽霊キーを生まない）。
// 逆に一部だけ欠けている記録はキーを作る＝保存側も同じ欠損でキーを作るので、それが正しい座標になる。
const hasAnyCoord = (...values) => values.some((v) => v != null)

// 生記録 → { store, key }。座標を持たない・オブジェクトでない入力は null（全域関数＝throw しない）。
export function recordGroupOf(record) {
  if (record == null || typeof record !== 'object' || Array.isArray(record)) return null
  const { source, level, theme, mode, rank, storyId, endCondition, range } = record

  if (source === 'word') {
    if (!hasAnyCoord(level, theme, mode)) return null
    return { store: 'wordRecords', key: wordRecKey(level, theme, mode, endCondition, range) }
  }
  if (source === 'dict') {
    if (!hasAnyCoord(level, theme, mode)) return null
    return { store: 'dictRecords', key: dictRecKey(level, theme, mode, endCondition, range) }
  }
  if (source === 'story') {
    if (storyId == null) return null // storyId 無しの物語キーは存在しえない
    return { store: 'storyRecords', key: storyRecKey(storyId, endCondition) }
  }
  // 残り（sentence/wsent/touch/romaji・source 未指定）は records マップ。
  // source 未指定は recKey の既定 source='sentence' に委ね、従来キー（both__r1 等）と一致させる。
  if (!hasAnyCoord(mode, rank)) return null
  return { store: 'records', key: recKey(mode, rank, source, theme, endCondition, range) }
}
