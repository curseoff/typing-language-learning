// TypingSession Entity の Factory（#290 Phase5）。
// Factory は生成手順（採番＋endCondition VO の合成）をカプセル化する。
// 肝は「同一性(ID)を注入された生成器 nextId から供給する」こと：
//   - 純ドメインは ID を作れない（Date/乱数/counter 非依存）ので nextId を外部から注入する。
//   - 実運用では uuid や連番カウンタなどを注入する（テストは決定的な生成器を渡す）。
// 純ドメイン：React/DOM/時間/乱数 非依存。
import { startTypingSession } from './typingSession.js'

// nextId（()=>string の ID 生成器）を注入して Factory を作る。関数でなければ throw。
export function createTypingSessionFactory(nextId) {
  if (typeof nextId !== 'function') {
    throw new Error('createTypingSessionFactory: nextId は ID 生成器（関数）が必要')
  }
  return {
    // 毎回 nextId() で採番し、endCondition VO は加工せず合成して Entity を生成する。
    // endCondition が不正なら startTypingSession が throw する。
    start(endCondition) {
      return startTypingSession({ id: nextId(), endCondition })
    },
  }
}
