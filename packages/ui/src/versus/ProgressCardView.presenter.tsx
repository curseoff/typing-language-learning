// #432 穴埋め対戦：1人ぶんの進捗カード presenter（純粋描画・props とコールバックだけ）。
// 対戦中に各参加者の進み具合を数値で見せる。勝敗軸は「正解問題数」なので強調して並べる。
// カンニング防止のため問題テキストは受け取らない（自分の問題表示はプレイ画面側が担う）＝ここは数値のみ。

// カード1枚ぶんのデータ。VersusBoardView が配列で持ち、各要素をそのままこのカードへ渡す。
export interface ProgressCardData {
  id: string // 参加者の peerId（生 UUID。表示は先頭 8 文字に短縮）
  name?: string // 表示名（任意。無ければ短縮 ID を主見出しにする）
  self: boolean // 自分のカードか（true は枠を強調）
  typed: number // タイピング数（打鍵で確定した文字数）
  speed: number // 速度（打/分）
  mistakes: number // ミス数
  elapsedSec: number // 経過秒
  limitSec?: number // 制限秒（時間終了条件時に `経過 / 制限秒` を出す。無ければ経過のみ）
  correct: number // 正解問題数（＝勝敗軸・目立たせる）
  lives?: number // 残ライフ（サドンデス時のみ・undefined なら非表示）
  finished?: boolean // #432 その参加者が完了したか（true で「完了」バッジを出す）
  rank?: number // #432 終了後の順位（1始まり・同点は同順位）。undefined なら順位バッジ非表示。
}

// peerId（生 UUID）は意味を持たないので、見出しでは先頭 8 文字だけを表示する。
function shortId(id: string): string {
  return id.slice(0, 8)
}

// 数値枠（タイピング数/速度/ミス/時間）。既存プレイ/結果 UI の stat 枠に準じた見た目。
function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="vs-card-stat">
      <div className="vs-card-stat-label">{label}</div>
      <div className="vs-card-stat-value">{value}</div>
    </div>
  )
}

export default function ProgressCardView({
  id,
  name,
  self,
  typed,
  speed,
  mistakes,
  elapsedSec,
  limitSec,
  correct,
  lives,
  finished,
  rank,
}: ProgressCardData) {
  const timeText = limitSec != null ? `${elapsedSec} / ${limitSec}秒` : `${elapsedSec}秒`

  return (
    <div className={`vs-card${self ? ' vs-card-self' : ''}`}>
      <div className="vs-card-head">
        <span className="vs-card-name">{name || shortId(id)}</span>
        <span className="vs-card-badges">
          {/* #432 順位（終了後のみ・同点は同順位）。勝敗軸の correct から container が算出。 */}
          {rank != null && <span className="vs-card-rank">{rank}位</span>}
          {/* #432 完了/待機の可視化：完了した参加者に「完了」バッジを出す。 */}
          {finished && <span className="vs-card-finished">完了</span>}
          <span className="vs-card-id">
            {self ? 'あなた' : '相手'}（{shortId(id)}）
          </span>
        </span>
      </div>

      {/* タイピング数/速度/ミス/時間 の 4 枠。 */}
      <div className="vs-card-stats">
        <CardStat label="タイピング数" value={String(typed)} />
        <CardStat label="速度（打/分）" value={String(speed)} />
        <CardStat label="ミス" value={String(mistakes)} />
        <CardStat label="時間" value={timeText} />
      </div>

      {/* 勝敗軸＝正解問題数。数値枠より目立たせる。 */}
      <div className="vs-card-correct">
        <span className="vs-card-correct-label">正解問題数</span>
        <span className="vs-card-correct-value">{correct}</span>
      </div>

      {/* 残ライフ（サドンデス時のみ）。ハートで残数を示す。 */}
      {lives != null && (
        <div className="vs-card-lives" aria-label={`残りライフ ${lives}`}>
          {Array.from({ length: lives }, (_, i) => (
            <span key={i} className="vs-heart" aria-hidden="true">
              ♥
            </span>
          ))}
          <span className="vs-card-lives-count">{lives}</span>
        </div>
      )}
    </div>
  )
}
