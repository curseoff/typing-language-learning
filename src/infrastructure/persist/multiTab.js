// #273 Phase3b: 多タブ協調のブラウザ API 配線（Web Locks 主タブ選出＋副タブ read-only＋
// BroadcastChannel 伝播＋handoff 昇格）。方式③：主タブ1つが単一ライター、副タブは snapshot を
// 受領して記録閲覧のみ（保存不可）、主が閉じたら待機中の副が1つ昇格する。
//
// 依存方向：この infra モジュールは application を静的 import しない。純ロジック
// （electionTransition / handleSecondaryMessage）とファサード操作（facade.*）は composition root
// （main.jsx）から注入で受け取る（infra → application の逆流を避ける）。ブラウザ API
// （navigator.locks / BroadcastChannel / crypto.randomUUID / window イベント）だけをここで触る。
//
// jsdom/node で単体計測できない Worker・Web Locks・BroadcastChannel 配線＝registerSW.js や
// infrastructure/db/* と同種のエントリ配線として coverage 除外。実挙動（2タブ primary/secondary・
// handoff・snapshot 伝播）は pwa-verifier の実ブラウザ検証で担保する。
//
// 4つの設計ガード（PoC で確認済み）：
//   ①昇格確定（held-lock コールバック発火）後にのみ書込み解禁 … facade.initPrimary/promote 内で
//     write-queue の setReady(true) が走る（この配線は「昇格確定してから」initPrimary/promote を呼ぶ）。
//   ②BroadcastChannel はベストエフォート … snapshot req/resp はタイムアウト＋再送する。
//   ③主不在の過渡（主 close 直後〜新主のコールバックまで） … 副の snapshot-request はリトライ前提。
//   （②③は requestSnapshot のタイマー再送で実装）。
//   epoch 単調性：昇格前に観測済みの最新 epoch を election 状態へ種として与えてから promote する
//     （タブごとに 0 起点の election.epoch がハンドオフで衝突しないように）。
//
// 主の write-through 通知は RecordsChanged ドメインイベントを介して BroadcastChannel へ流す
// （発行=records.js から呼ばれる onChange／購読=change を post して多タブへ伝播）。
// イベントバス（application）は他の純ロジック同様 composition root から deps.bus で注入する
//   （infra → application の逆流を避ける。ここで createEventBus を直 import しない）。

import { recordsChangedEvent } from '../../domain/events/recordEvents.event.js'

const CHANNEL = 'tll-db'
const LOCK = 'tll-db'
const SNAPSHOT_TIMEOUT_MS = 800 // 主の snapshot 応答をこの時間待って来なければ再送
const MAX_SNAPSHOT_RETRIES = 6 // 主不在の過渡を吸収する再送上限（超えたら空像で描画継続）

// BroadcastChannel メッセージ規約（port 転送不可なので tabId+reqId で相関する）：
//   primary-changed { type, epoch, primaryTabId }        新主の告知（全副へ）
//   snapshot-request { type, tabId, reqId, epoch }        副→主の像要求
//   snapshot        { type, epoch, image, forTabId, reqId } 主→特定副の像応答
//   change          { type, epoch }                        主の書込み通知（全副へ）

// 多タブ永続化を起動する。deps はすべて composition root から注入（infra 純度を保つため）。
//   electionTransition, handleSecondaryMessage … application の純ロジック
//   bus … application のイベントバス（createEventBus() の戻り＝同期 pub/sub）
//   openStorage … async () => handle|null（infrastructure/db の initStorage ラッパ。null＝失敗）
//   facade … { initPrimary(handle,image,{epoch,onChange}), promote(handle,image,{epoch,onChange}),
//             initSecondary(image,{epoch}), replaceImage(image,epoch), getImage() }
// 戻り値：{ whenReady } … 初期ロールのデータ（主=hydrate 完了 / 副=初回 snapshot or 再送打切り）が
// 整うと解決する Promise（main.jsx はこれを待ってから render する）。
export function startMultiTabPersistence(deps) {
  const {
    electionTransition,
    handleSecondaryMessage,
    bus,
    openStorage,
    facade,
    channelName = CHANNEL,
    lockName = LOCK,
    snapshotTimeoutMs = SNAPSHOT_TIMEOUT_MS,
    maxSnapshotRetries = MAX_SNAPSHOT_RETRIES,
    newId = () => crypto.randomUUID(),
  } = deps

  const tabId = newId()
  const channel = new BroadcastChannel(channelName)

  let election = { role: 'unknown', epoch: 0 } // 自タブの選出状態
  let secState = { epoch: 0 } // 副タブが把握している最新 epoch（snapshot 判定用）
  let observedEpoch = 0 // 観測した最大 epoch（昇格時に election へ種として与える）
  let secondaryInitialized = false // 初回 snapshot で initSecondary 済みか
  let pendingReq = null // { reqId, retries, timer } 進行中の snapshot 要求
  let held = null // 保持中ロックを解放する resolver（pagehide で解放）

  let resolveReady
  const whenReady = new Promise((r) => {
    resolveReady = r
  })
  const markReady = () => {
    if (resolveReady) {
      resolveReady()
      resolveReady = null
    }
  }

  const rememberEpoch = (e) => {
    if (typeof e === 'number' && e > observedEpoch) observedEpoch = e
  }

  // ── broadcast ヘルパ（epoch は自タブ election の世代を正とする）──
  const post = (msg) => {
    try {
      channel.postMessage(msg)
    } catch {
      // チャネル閉鎖後などの postMessage 失敗は握りつぶす（ベストエフォート）。
    }
  }
  const broadcastPrimaryChanged = () =>
    post({ type: 'primary-changed', epoch: election.epoch, primaryTabId: tabId })
  // 購読：RecordsChanged を受けたら change を BroadcastChannel へ post（実 post は購読側で行う）。
  bus.subscribe('RecordsChanged', (e) => post({ type: 'change', epoch: e.epoch }))
  // 発行：records.js の write-through から onChange が呼ばれると RecordsChanged を発行する
  //   （epoch は自タブ election の世代＝購読側が e.epoch で post するので挙動不変）。
  const broadcastChange = () => bus.publish(recordsChangedEvent({ epoch: election.epoch }))

  // ── 主タブ：初回主確定 or handoff 昇格の共通後処理 ──
  async function becomePrimary(kind) {
    // kind: 'initial'（unknown→primary）| 'promoted'（secondary→primary）
    // 昇格前に観測済み最新 epoch を election へ種付けし、ハンドオフでの epoch 衝突を防ぐ。
    election = { ...election, epoch: Math.max(election.epoch, observedEpoch) }
    election = electionTransition(election, {
      type: kind === 'promoted' ? 'promote-granted' : 'lock-granted',
    })
    rememberEpoch(election.epoch)

    // 進行中の snapshot 再送を止める（自分が主になったので不要）。
    cancelPendingReq()

    // OPFS を開き直して DB から再 hydrate する（handoff では stale な副 snapshot を破棄＝ガード③後段）。
    const handle = await openStorage()
    if (!handle) {
      // 昇格先で保存基盤を開けない稀ケース。書込みは諦めるが描画は継続（best-effort）。
      console.warn('[persist] 昇格時に保存基盤を開けませんでした。閲覧のみで続行します。')
      markReady()
      return
    }
    const image = await handle.hydrate()
    const opts = { epoch: election.epoch, onChange: broadcastChange }
    // ガード①：ここで facade 側が write-queue.setReady(true) を呼ぶ＝昇格確定後にのみ書込み解禁。
    if (kind === 'promoted') facade.promote(handle, image, opts)
    else facade.initPrimary(handle, image, opts)

    // 新主の告知（handoff で待っていた他の副へ／初回主でも遅参の副が拾えるよう送る）。
    broadcastPrimaryChanged()
    markReady()
  }

  // ── 副タブ：snapshot 要求（ガード②③：タイムアウト＋再送・リトライ前提）──
  function cancelPendingReq() {
    if (pendingReq && pendingReq.timer) clearTimeout(pendingReq.timer)
    pendingReq = null
  }
  function requestSnapshot() {
    // 既存の要求があれば作り直す（最新 epoch を載せ直す）。
    if (pendingReq && pendingReq.timer) clearTimeout(pendingReq.timer)
    const retries = pendingReq ? pendingReq.retries : 0
    const reqId = newId()
    pendingReq = { reqId, retries, timer: null }
    post({ type: 'snapshot-request', tabId, reqId, epoch: secState.epoch })
    pendingReq.timer = setTimeout(() => {
      if (!pendingReq || pendingReq.reqId !== reqId) return
      if (pendingReq.retries >= maxSnapshotRetries) {
        // 主不在が続く過渡：空像で描画を進め、以後の change/primary-changed で追従する。
        if (!secondaryInitialized) {
          facade.initSecondary({}, { epoch: secState.epoch })
          secondaryInitialized = true
        }
        cancelPendingReq()
        markReady()
        return
      }
      pendingReq.retries += 1
      requestSnapshot()
    }, snapshotTimeoutMs)
  }

  function becomeSecondary() {
    election = electionTransition(election, { type: 'lock-unavailable' })
    requestSnapshot()
    // 主が閉じたら昇格できるよう、ブロッキングでロック取得列に並ぶ（handoff の待ち受け）。
    queuePromotion()
  }

  // ── メッセージ受信 ──
  channel.onmessage = (e) => {
    const msg = e.data
    if (!msg || typeof msg !== 'object') return

    if (election.role === 'primary') {
      // 主タブ：副からの snapshot 要求にのみ応答する（自分が正の像を持つ）。
      if (msg.type === 'snapshot-request') {
        post({
          type: 'snapshot',
          epoch: election.epoch,
          image: facade.getImage(),
          forTabId: msg.tabId,
          reqId: msg.reqId,
        })
      }
      return
    }

    // 副タブ：自分宛でない snapshot（別の副向け）は無視する。
    if (msg.type === 'snapshot' && msg.forTabId !== tabId) return

    const { nextState, effect } = handleSecondaryMessage(secState, msg)
    secState = nextState
    rememberEpoch(secState.epoch)

    if (effect === 'replace-image') {
      // 主から届いた最新像でメモリ像をセット/差し替え（read-only）。再送タイマーは止める。
      cancelPendingReq()
      if (!secondaryInitialized) {
        facade.initSecondary(msg.image, { epoch: msg.epoch })
        secondaryInitialized = true
      } else {
        facade.replaceImage(msg.image, msg.epoch)
      }
      markReady()
    } else if (effect === 'request-snapshot') {
      requestSnapshot()
    }
    // 'ignore' は何もしない。
  }

  // ── Web Locks：主タブ選出 ──
  // ブロッキングでロックを取り、granted で onGranted、保持中は held の解決まで離さない（handoff 待ち）。
  function queuePromotion() {
    navigator.locks
      .request(lockName, { mode: 'exclusive' }, () => {
        // 待っていたロックが来た＝旧主が閉じた → 昇格。
        becomePrimary('promoted')
        return new Promise((res) => {
          held = res // pagehide まで保持
        })
      })
      .catch(() => {})
  }

  async function elect() {
    // ifAvailable で「今すぐ取れるか」を判定しつつ、取れたらそのまま保持して初回主になる
    // （probe と hold を分けると隙間で他タブに奪われるため、取得と保持を1コールで行う）。
    const gotImmediately = await new Promise((resolve) => {
      navigator.locks
        .request(lockName, { ifAvailable: true, mode: 'exclusive' }, (lock) => {
          if (!lock) {
            resolve(false)
            return undefined // 取れなかった（＝他タブが主）→ 副へ
          }
          resolve(true)
          return new Promise((res) => {
            held = res // 取れた＝初回主。pagehide まで保持。
          })
        })
        .catch(() => resolve(false))
    })

    if (gotImmediately) await becomePrimary('initial')
    else becomeSecondary()
  }

  // 主が閉じる/離脱するとき保持ロックを解放し、待機中の副を1つ昇格させる。
  const onPageHide = () => {
    if (held) {
      held()
      held = null
    }
  }
  window.addEventListener('pagehide', onPageHide)

  elect().catch((err) => {
    console.warn('[persist] 多タブ選出に失敗しました。', err)
    markReady() // 失敗しても render は止めない
  })

  return { whenReady, tabId }
}
