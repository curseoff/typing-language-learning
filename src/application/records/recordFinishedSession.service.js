// #290 Phase 8: Application Service（ユースケースの薄い調停層）。
//   これは「1回のプレイ完了」というユースケースを実現するだけの薄い調停層であり、
//   業務ルール（判定・計算・整列・上限）は一切持たない。
//   Domain Service（sessionToRecord：状態→記録の変換）・Repository（submitRecord：永続化＝
//   read-modify-write と整列/上限）・Domain Event（sessionFinishedEvent/recordAchievedEvent：
//   起きた事実の通知）を、決められた順序で順に呼ぶだけである。
//   これまでの全戦術部品（VO/Entity/Factory/Domain Service/Aggregate/Repository/Event）が
//   1つのユースケースに集約される capstone。
//   純アプリ層：React/DOM/Date/乱数 非依存（時刻等の外部値は meta として注入で受け取る）。
import { sessionToRecord } from '../../domain/records/sessionResult.service.js'
import { recKey } from '../../domain/records/ranking.service.js'
import {
  sessionFinishedEvent,
  recordAchievedEvent,
} from '../../domain/events/recordEvents.event.js'

// 1プレイ完了を調停する：record 生成 → key 算出 → Repository へ submit → イベント2発 → 返す。
export function recordFinishedSession({ session, meta, repository, bus }) {
  // Domain Service：セッションの状態＋採点＋メタから記録オブジェクトを作る（純変換）。
  const record = sessionToRecord(session, meta)
  // Domain：記録の格納先ランキングキーを算出（終了条件別キー込み）。
  const key = recKey(meta.mode, meta.rank, meta.source, meta.theme, session.endCondition, meta.range)
  // Repository：read-modify-write で永続化し、整列/上限済みの最新集約を得る。
  const board = repository.submitRecord(key, session.endCondition, record)
  // Domain Event：記録の後に「起きた事実」を発行（submit と同一 record 参照を渡す）。
  bus.publish(sessionFinishedEvent({ sessionId: session.id, record }))
  bus.publish(recordAchievedEvent({ key, record }))
  return { record, key, board }
}
