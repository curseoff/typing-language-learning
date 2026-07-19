// #439 対戦：画面最上部の独立ヘッダバー（全 versus モード共通・純粋描画）。
// 種類/レベル/モード（PlayMeta 相当）＋残り（時間 or 問題数）＋進捗バーを1本のバーへ集約する。
// 各盤面（あなた/相手）からは PlayMeta/StatsRow を出さず、上部の重複表示をここへ一本化する（#439）。
// self の live 値（endStat の label/value＋progress）を container から受けるだけの純粋描画。
import type { ReactNode } from 'react'
import { StatsRow } from '../shared/Stats.presenter'

export interface MatchHeaderBarProps {
  levelLabel: string // レベルバッジ（例 "L1" / "W1"）
  metaSub: string // 種類・モード・テーマ（例 "英英 / 英語入力 / すべて"）
  statLabel: ReactNode // 残り表示のラベル（endStat.label＝残り時間/問題数 等）
  statValue: ReactNode // 残り表示の値（endStat.value）
  progress: number // 進捗（0..1）
}

export default function MatchHeaderBar({ levelLabel, metaSub, statLabel, statValue, progress }: MatchHeaderBarProps) {
  return (
    <div className="vs-match-header">
      <div className="play-meta">
        <span className="meta-badge rank">{levelLabel}</span>
        <span className="meta-badge mode">{metaSub}</span>
      </div>
      <StatsRow stats={[{ label: statLabel, value: statValue }]} progress={progress} />
    </div>
  )
}
