// 「プレイ1回」を表す Entity `TypingSession`（#290 Phase2）。
// EndCondition VO（Phase1・不変・値等価）と対照的な Entity：
//   - ID を持つ（同一性）。値ではなく ID で等価判定する（sessionEquals）。
//   - 可変な状態（progress・status）を持ち、時間とともに変化する。
//   - ライフサイクル active→finished を持つ。
//   - 不変条件を守る（finished 後は状態を変えない＝throw）。
//   - EndCondition VO を内包（合成）する＝妥当な VO のみ受け入れる。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存。ID・elapsedMs は外部から注入する。
import { isEndCondition, shouldFinish } from './endCondition.vo.js'

// TypingSession を生成する（自己検証つき）。不変条件違反は throw。
//   id            … 非空文字列必須（同一性の基盤）。
//   endCondition  … isEndCondition を満たす妥当な VO 必須（内包する合成対象）。
export function startTypingSession({ id, endCondition } = {}) {
  if (typeof id !== 'string' || id === '') {
    throw new Error(`startTypingSession: id は非空文字列が必要: ${String(id)}`)
  }
  if (!isEndCondition(endCondition)) {
    throw new Error('startTypingSession: endCondition は妥当な EndCondition VO が必要')
  }

  // 内部可変状態（カプセル化＝外部へは凍結スナップショットしか渡さない）。
  const progress = { keys: 0, mistakes: 0, items: 0, missedItems: 0, elapsedMs: 0 }
  let status = 'active'

  // finished（明示 finish 済み）なら状態変更を拒む不変条件ガード。
  // 注：status は明示 finish() でのみ 'finished' になる。endCondition 到達だけでは
  // 'active' のまま（進捗変更はまだ可能）＝終了は isFinished() が別途 shouldFinish で見る。
  function assertMutable() {
    if (status === 'finished') {
      throw new Error('TypingSession: finished 後は状態を変更できない')
    }
  }

  return {
    id,
    endCondition,
    status() {
      return status
    },
    registerHit() {
      assertMutable()
      progress.keys++
    },
    registerMiss() {
      assertMutable()
      progress.mistakes++
    },
    advanceItem(missed = false) {
      assertMutable()
      progress.items++
      if (missed) progress.missedItems++
    },
    setElapsed(ms) {
      assertMutable()
      progress.elapsedMs = ms
    },
    finish() {
      status = 'finished'
    },
    isFinished() {
      // 明示終了 or 終了条件到達（endCondition 連動）。
      return status === 'finished' || shouldFinish(endCondition, progress)
    },
    progress() {
      // 毎回、現在値の新しい凍結スナップショットを返す（内部参照は渡さない）。
      return Object.freeze({ ...progress })
    },
  }
}

// 同一性（ID）による等価判定（throw しない・boolean）。
// VO の値等価と対照：進捗や endCondition が同じでも ID が違えば別の実体＝false。
// 両者が TypingSession 相当（id を持つ）で id が一致すれば true。null/不正は false。
export function sessionEquals(a, b) {
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (typeof a.id !== 'string' || typeof b.id !== 'string') return false
  return a.id === b.id
}
