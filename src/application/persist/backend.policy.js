// #266 Phase3a / #274 スライス1: 永続化バックエンドの選択（純関数・DOM/infra 非依存）。
// resolvePersistBackend＝入力ソース（url/ls/env）の優先順で希望バックエンドを決める。
// chooseBackend＝希望と実行環境の能力フラグから、実際に使えるバックエンドへ縮退する。
// diagnosePersistFallback＝縮退結果と、その理由コードをあわせて返す。
// 既定は 'sqlite'。非対応環境は 'memory'（非永続・メモリのみ）へ縮退する。

// 受理する値は 'sqlite' | 'memory' のみ。trim＋小文字化して判定し、無効値は null（＝スキップ）。
// レガシー 'local' は VALID に含まれないため無効値として飛ばされる（→既定 sqlite へフォールバック）。
const VALID = new Set(['sqlite', 'memory'])

function normalize(v) {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  return VALID.has(t) ? t : null
}

// url > ls > env の優先順で最初に有効な値を採用し、全て無効なら既定 'sqlite'。
export function resolvePersistBackend({ url, ls, env } = {}) {
  return normalize(url) ?? normalize(ls) ?? normalize(env) ?? 'sqlite'
}

// desired が sqlite でも、OPFS/Worker/Web Locks の能力が1つでも欠ければ memory へ縮退する。
// desired が memory なら能力に関係なく memory（明示的に非永続を要求）。
export function chooseBackend({ desired, opfsOk, workerOk, locksSupported }) {
  if (desired === 'sqlite' && opfsOk && workerOk && locksSupported) return 'sqlite'
  return 'memory'
}

// chooseBackend の結果に加え、なぜその backend になったかの reason コードを返す。
// backend は chooseBackend と必ず一致する（不変条件）。
// reason: 'ok'（sqlite 付与成功）/ 'forced-memory'（desired=memory）/
//         能力欠如は opfs→worker→locks の優先順で最初の1つ（'no-opfs'/'no-worker'/'no-locks'）。
export function diagnosePersistFallback({ desired, opfsOk, workerOk, locksSupported }) {
  const backend = chooseBackend({ desired, opfsOk, workerOk, locksSupported })
  let reason
  if (backend === 'sqlite') reason = 'ok'
  else if (desired !== 'sqlite') reason = 'forced-memory'
  else if (!opfsOk) reason = 'no-opfs'
  else if (!workerOk) reason = 'no-worker'
  else reason = 'no-locks'
  return { backend, reason }
}
