// 効果音のミュート切替ボタン（presenter）：muted 状態と onToggle を props で受け、
// 固定ボタン＋SVG アイコン（オン=音波／ミュート=×）を描くだけ。設定の読み書き（localStorage）は
// container 側。他の固定要素（オフラインバナー=上部中央／更新トースト=下部中央／インストール=右下／
// フォールバック告知=左下／DEVパネル=左下）とは左上で棲み分ける。
// aria-pressed でミュート状態を、aria-label で操作内容を読み上げに伝える。
export interface SoundToggleProps {
  muted: boolean
  onToggle: () => void
}

export default function SoundToggle({ muted, onToggle }: SoundToggleProps) {
  return (
    <button
      className="sound-toggle"
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? '効果音をオンにする' : '効果音をオフにする'}
      title={muted ? '効果音: オフ' : '効果音: オン'}
    >
      <span className="sound-toggle__icon" aria-hidden="true">
        {muted ? (
          // ミュート（スピーカー＋×）
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          // オン（スピーカー＋音波）
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        )}
      </span>
    </button>
  )
}
