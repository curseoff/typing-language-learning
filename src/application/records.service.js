// 記録の読み・書き・キー生成を application 層に集約するファサード。
// UI(.jsx) もフックも infrastructure を直接 import せず、ここ経由で記録を読み書きする
// （依存方向 ui → application → infrastructure を守るため。infra 直 import は facade のみ）。
//
// #274 スライス2：永続化を sqlite 専用へ転換。localStorage 経路は撤去し、非sqlite の既定は
//   backend='memory'（既定）… メモリ像 image のみで読み書き（非永続・localStorage を一切触らない）。
//   backend='sqlite'      … 起動時に構築したメモリ像から同期読み／save はメモリ像を即時更新して
//                            同期で更新後マップを返し、Worker への差分書き込みは write-queue 経由で
//                            fire-and-forget（write-through）。
// memory/sqlite の両モードとも read/write はメモリ像 image を経由する（消費側は無改修）。
// キー生成（wordRecKey/dictRecKey/storyRecKey/itemId）は domain の純粋関数を使う（#274）。
import { wordRecKey, dictRecKey, storyRecKey, itemId, statPrefix } from '../domain/records/recordKeys.service.js'
import { recordGroupOf } from '../domain/records/recordGroup.service.js'
import {
  buildImage,
  applyDeleteAt,
  applySaveRecord,
  applySaveWordRecord,
  applySaveDictRecord,
  applyRecordItemStat,
  applySaveStoryRecord,
  applySaveFound,
} from './persist/memoryStore.policy.js'
import { createWriteQueue } from './persist/writeQueue.service.js'

// ── バックエンド状態（モジュール内シングルトン）──
let backend = 'memory' // 'memory'（既定・非永続）| 'sqlite'
let image = buildImage() // 全記録のメモリ像（buildImage の6マップ・未初期化でも空像で安全に読める）
let queue = null // Worker への差分書き込みを直列化する write-queue（sqlite 主タブのみ・memory は null）

// #273 Phase3b: 多タブ協調の状態。主タブ＝書込み可（write-through＋change broadcast）、
// 副タブ＝read-only（メモリ像は当該タブ表示用に楽観更新するが Worker 書込みも通知もしない）。
let role = 'primary' // 'primary' | 'secondary'（sqlite 経路でのみ意味を持つ）
let epoch = 0 // 主タブ世代カウンタ（change 通知に載せて副の stale 判定に使う）
let broadcastChange = null // 主タブが write-through 後に呼ぶ change 通知（(epoch)=>void・注入）
let secondaryWriteAttempted = false // 副タブで保存要求が起きたら立てる（UI の控えめ告知用）

// 起動時（main.jsx）に sqlite バックエンドを「主タブ」として有効化する。initialImage は Worker の
// hydrate 結果。handle は initStorage() のハンドル（save(repo, args)→Worker）。以後 save は
// write-through。opts.epoch＝主タブ世代、opts.onChange＝write-through 後の change broadcast。
export function initSqlitePersistence(handle, initialImage, opts = {}) {
  image = buildImage(initialImage)
  queue = createWriteQueue((op) => handle.save(op.repo, op.args))
  queue.setReady(true) // 主確定（lock-granted コールバック発火）後に呼ばれる＝書込み解禁（ガード①）
  backend = 'sqlite'
  role = 'primary'
  epoch = opts.epoch ?? epoch
  broadcastChange = opts.onChange ?? null
}

// 非sqlite の既定＝memory モードを確立する（非永続・メモリ像のみ・localStorage を触らない）。
// initialImage を渡せばその像から開始（省略時は空像）。テストの状態リセットにも使う。
export function initMemoryPersistence(initialImage) {
  image = buildImage(initialImage)
  queue = null
  backend = 'memory'
  role = 'primary'
  broadcastChange = null
}

// 副タブとして sqlite バックエンドを有効化する（read-only）。initialImage は主から受領した snapshot。
// Worker handle を持たない＝write-through しない。次 snapshot で主の真実に置換される。
export function initSecondaryPersistence(initialImage, opts = {}) {
  image = buildImage(initialImage)
  queue = null
  broadcastChange = null
  backend = 'sqlite'
  role = 'secondary'
  epoch = opts.epoch ?? epoch
}

// 副タブが新しい snapshot を受領したときにメモリ像を丸ごと差し替える（read-image 更新）。
export function replaceImage(newImage, newEpoch) {
  image = buildImage(newImage)
  if (newEpoch != null) epoch = newEpoch
}

// handoff 昇格：副→主。主が閉じ OPFS を開き直して再 hydrate した handle/像で write-queue を張り直し、
// setReady(true) で書込みを解禁する（ガード①：昇格確定後にのみ書込み解禁）。
export function promoteToPrimary(handle, freshImage, opts = {}) {
  if (freshImage !== undefined) image = buildImage(freshImage)
  queue = createWriteQueue((op) => handle.save(op.repo, op.args))
  queue.setReady(true)
  role = 'primary'
  epoch = opts.epoch ?? epoch
  broadcastChange = opts.onChange ?? broadcastChange
}

// 現在の永続化ロール（memory は常に書込み可＝primary 相当）。UI の read-only 告知判定に使う。
export function getPersistRole() {
  return isSqlite() ? role : 'primary'
}
// 主タブが snapshot 応答に載せる現在のメモリ像と世代。
export function getPersistImage() {
  return image
}
export function getPersistEpoch() {
  return epoch
}
// 副タブで保存要求が起きたかを読み取り、フラグを消費する（UI が一度だけ告知するため）。
export function consumeSecondaryWriteAttempt() {
  const v = secondaryWriteAttempted
  secondaryWriteAttempted = false
  return v
}

const isSqlite = () => backend === 'sqlite'

// 保留中の write-through を Worker へ流し切って完了を待つ（#267 export 前の flush）。
// 主タブ以外（memory/副タブ＝queue なし）は待つものが無いので即解決する。
export async function flushWrites() {
  if (queue) await queue.flush()
}

// sqlite 経路の書込み後段。主タブは Worker へ write-through＋change を broadcast、
// 副タブは read-only（何もせず告知フラグだけ立てる。メモリ像の楽観更新は呼び出し側で済ませ済み）。
function writeThrough(op) {
  if (role === 'secondary') {
    secondaryWriteAttempted = true
    return
  }
  if (!queue) return // memory: メモリ像のみ・非永続（Worker が無くてもクラッシュしない）
  queue.enqueue(op)
  if (broadcastChange) broadcastChange(epoch)
}

// ── ランキング（モード別）の読み書き ──
export function loadWordRecords() {
  return image.wordRecords
}
export function saveWordRecord(record) {
  image = { ...image, wordRecords: applySaveWordRecord(image.wordRecords, record) }
  writeThrough({ repo: 'word', args: [record] })
  return image.wordRecords
}
export function loadDictRecords() {
  return image.dictRecords
}
export function saveDictRecord(record) {
  image = { ...image, dictRecords: applySaveDictRecord(image.dictRecords, record) }
  writeThrough({ repo: 'dict', args: [record] })
  return image.dictRecords
}

// ── 物語（発見エンド＋記録）──
export function loadStoryRecords(storyId, endCondition) {
  return image.storyRecords[storyRecKey(storyId, endCondition)] || []
}
export function loadAllStoryRecords() {
  return image.storyRecords
}
export function saveStoryRecord(storyId, record) {
  image = { ...image, storyRecords: applySaveStoryRecord(image.storyRecords, storyId, record) }
  writeThrough({ repo: 'story', args: [storyId, record] })
  return image.storyRecords[storyRecKey(storyId, record.endCondition)] || []
}
export function saveFound(storyId, ids) {
  image = { ...image, storyFound: applySaveFound(image.storyFound, storyId, ids) }
  writeThrough({ repo: 'found', args: [storyId, ids] })
}
export function loadFound(storyId) {
  return image.storyFound[storyId] || []
}

// ── マラソンの記録 I/O（読み書き）。UI 合成層(App.jsx)の記録窓口をここに一本化 ──
export function loadRecords() {
  return image.records
}
export function saveRecord(record) {
  image = { ...image, records: applySaveRecord(image.records, record) }
  writeThrough({ repo: 'records', args: [record] })
  return image.records
}

// ── #451 記録の変更通知 ──
// 削除は application のメモリ像だけを書き換えるので、各プレイのフックが自前で持つ records
// state は取り残される（＝消したのに下敷きの結果ページのランキングに残り続ける）。そこで
// 「変更されたよ」だけを購読者へ配り、購読側は load*Records() で読み直して追随する。
//
// 保存（saveXxxRecord）では通知しない：保存は更新後マップを同期で返し、呼び出し側がその
// 戻り値で自分の state を差し替え済みだから。通知を足しても同じ更新が二重に走るだけで、
// 既存の保存経路の挙動を変えるリスクだけが増える。通知はあくまで削除の追いつき用。
//
// listener は購読側（React のフック）が unmount 時に解除する。init*Persistence は永続化の
// バックエンドを切り替えるだけで購読者のライフサイクルとは無関係なので、ここは触らない。
const recordsChangedListeners = new Set()

// 記録の変更（＝削除）を購読する。戻り値の解除関数を呼ぶまで通知が届く。
export function subscribeRecordsChanged(listener) {
  recordsChangedListeners.add(listener)
  return () => {
    recordsChangedListeners.delete(listener)
  }
}

function emitRecordsChanged() {
  // 通知中に購読/解除されても走査が壊れないようコピーしてから回す。
  for (const listener of [...recordsChangedListeners]) {
    try {
      listener()
    } catch {
      // 1つの購読者の失敗で他の画面の追随を巻き添えにしない（通知は付随処理で、
      // 削除そのものの成否には影響させない）。
    }
  }
}

// ── #451 記録の1件削除 ──
// store（メモリ像のマップ名）→ Worker の repo 名。削除専用 SQL は無く、更新後のグループ配列で
// DB のグループを丸ごと置き換える（メモリ像が正・保存と同じ「グループ置換」経路に乗せる）。
const DELETE_REPOS = {
  records: 'recordsGroup',
  wordRecords: 'wordGroup',
  dictRecords: 'dictGroup',
  storyRecords: 'storyGroup',
}

// 記録を1件削除する。position は UI/ランキング表示の順位そのまま（1 始まり）で、
// 0 始まりへの変換はここで閉じる（純ロジック applyDeleteAt は 0 始まりに統一されている）。
// 削除できたら true、対象が特定できなければ false を返し、その場合は書き込みを一切起こさない。
export function deleteRecordAt(record, position) {
  const group = recordGroupOf(record)
  if (!group) return false
  const { store, key } = group
  const index = position - 1
  const list = image[store]?.[key]
  if (!Array.isArray(list)) return false
  const target = list[index]
  // position がずれていた場合に「別の記録を巻き込んで消す」のが最悪の事故なので、
  // その位置に居るのが渡された記録本人かを確かめてからでないと消さない。
  // 通常は UI が像から読んだ記録をそのまま渡す＝同一参照。date は像を跨いだ場合の同一性判定。
  const isSame = target === record || (target != null && record.date != null && target.date === record.date)
  if (!isSame) return false

  const next = applyDeleteAt(image[store], key, index)
  image = { ...image, [store]: next }
  // 残り配列（空なら []）でグループを置換する。story だけはグループ座標に storyId が要る。
  const rest = next[key] || []
  const args = store === 'storyRecords' ? [record.storyId, record, rest] : [record, rest]
  writeThrough({ repo: DELETE_REPOS[store], args })
  // 消せたときだけ通知する（false で返る＝像を触っていない場合は購読者を起こさない）。
  emitRecordsChanged()
  return true
}

// 記録マップのキー生成（フック由来の records マップから該当条件を引くのに使う）。
export { wordRecKey, dictRecKey }

// 選択条件のランキング配列を直接取り出す（UI が records マップを持たない場面で使う）。
// endCondition を渡すと終了条件別キー（time60/未指定は従来キー）で引く（#208 段3b）。
export function wordRanking(level, theme, mode, endCondition, range) {
  return loadWordRecords()[wordRecKey(level, theme, mode, endCondition, range)]
}
export function dictRanking(level, theme, mode, endCondition, range) {
  return loadDictRecords()[dictRecKey(level, theme, mode, endCondition, range)]
}

// ── 問題ごとの収録統計 ──
export function loadItemStats() {
  return image.itemStats
}
// 問題別の累積統計を1件記録する（F-1：item_stats もファサードに集約）。戻り値は更新後マップ。
export function recordItemStat(id, delta) {
  image = { ...image, itemStats: applyRecordItemStat(image.itemStats, id, delta) }
  writeThrough({ repo: 'item', args: [id, delta] })
  return image.itemStats
}

// 収録一覧（ItemList）の type と mode から item-stats の id を作る。
// type='words'|'dict'|'marathon'（UI 都合の種類名）→ 記録上の接頭辞へ変換。
// #450 第4引数 versus（任意・既定 false）＝true なら対戦用の id を返す。省略時は従来と同一の id。
export function itemStatId(type, mode, key, versus = false) {
  const base = type === 'dict' ? 'd' : type === 'marathon' ? 's' : 'w'
  return itemId(statPrefix(base, versus), mode, key)
}

// #450 同じ問題の「通常プレイ id と対戦 id」を両方返す（表示側が合算するため）。
// 接頭辞の綴り（'w'/'vw' 等）は記録層の都合なので、UI にはこの窓口だけを見せて知らせない。
export function itemStatIds(type, mode, key) {
  return [itemStatId(type, mode, key, false), itemStatId(type, mode, key, true)]
}

// 物語の場面ごとの id（story:mode:storyId/nodeId）。物語別に分けて衝突を防ぐ。
export function storyStatId(mode, storyId, nodeId) {
  return itemId('story', mode, `${storyId}/${nodeId}`)
}
