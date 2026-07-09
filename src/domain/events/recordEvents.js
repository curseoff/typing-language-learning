// #290 Phase 7: Domain Event。
//   ドメインで「起きた事実」を不変の値（Value Object 的）で表す。
//   時刻や乱数などの外部要因は payload に注入して受け取り、イベント内では生成しない
//   （ドメインは Date を作らない＝決定的で純粋に保つ）。
//   生成物は Object.freeze で不変にする＝「起きた事実」は後から書き換わらない。
//   事実の同定に必要な必須情報が欠ければ throw する。

// セッション完了という事実のイベント値。
export function sessionFinishedEvent({ sessionId, record }) {
  if (!sessionId) throw new Error('sessionFinishedEvent: sessionId is required')
  return Object.freeze({ type: 'SessionFinished', sessionId, record })
}

// 記録更新という事実のイベント値。
export function recordAchievedEvent({ key, record }) {
  if (!key) throw new Error('recordAchievedEvent: key is required')
  return Object.freeze({ type: 'RecordAchieved', key, record })
}

// イベント値の判定（throw しない）。type を文字列で持つオブジェクトを真とする。
export function isDomainEvent(x) {
  return typeof x === 'object' && x !== null && typeof x.type === 'string'
}
