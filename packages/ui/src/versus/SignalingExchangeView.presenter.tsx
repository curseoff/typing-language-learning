// #426 対戦基盤スライス4：接続コード交換の presenter（手動シグナリング・QR なし＝コピペ＋共有URL）。
// 純粋描画のみ：props とコールバックだけで描く（content/application/infrastructure/フックを import しない）。
// セッションの状態機械・WebRTC・クリップボード配線は app 側の container（VersusConnect.container.jsx）が担い、
// ここは「役割選択→ホスト/ゲスト手順→接続確認」の見た目だけを持つ。貼付欄の一時テキストのみ局所 state。
import { useState } from 'react'

export type VersusRole = 'host' | 'guest'
export type VersusConnection = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface SignalingExchangeViewProps {
  role: VersusRole | null // 選択済みの役割（未選択は null＝役割選択を出す）
  connection: VersusConnection // 接続状態（未接続/接続中/接続済/切断）
  selfId: string // 自分の peerId（参加者一覧で「あなた」を示す）
  offerCode?: string | null // ホストが提示する接続コード（相手へ渡す）
  answerCode?: string | null // ゲストが返す応答コード（ホストへ返す）
  shareUrl?: string | null // ホストの共有URL（#versus=<code>・コピー用に container が組み立てる）
  activeIds?: string[] // 参加者一覧（離脱を除いた active な peerId・container が roster から算出）
  error?: string | null // 直近のエラー文（コード不正・生成失敗など）
  onSelectHost: () => void // 「部屋を作る」＝ホストとして offer を生成
  onSelectGuest: () => void // 「部屋に入る」＝ゲストとして offer 貼付欄を出す
  onSubmitOffer: (code: string) => void // ゲスト：貼り付けた offer を確定（joinRoom）
  onSubmitAnswer: (code: string) => void // ホスト：貼り付けた answer を確定（acceptAnswer）
  onCopy?: (text: string) => void // コピー配線（container が clipboard へ）。無ければコピーボタンは出さない
  onBack?: () => void // 役割選択へ戻る/画面を出る導線（任意）
}

// 接続状態の日本語ラベル（バッジ表示用）。
const CONNECTION_LABEL: Record<VersusConnection, string> = {
  idle: '未接続',
  connecting: '接続中…',
  connected: '接続済み',
  disconnected: '切断されました',
}

// コピー可能なコード欄（読み取り専用のテキスト＋コピーボタン）。onCopy 未配線ならボタンは省く。
function CodeBlock({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy?: (text: string) => void
}) {
  return (
    <div className="vs-codeblock">
      <label className="vs-label">{label}</label>
      <textarea className="vs-code" readOnly rows={4} value={value} />
      {onCopy && (
        <button type="button" className="vs-btn vs-btn-secondary vs-copy" onClick={() => onCopy(value)}>
          コピー
        </button>
      )}
    </div>
  )
}

// 貼付欄（相手から受け取ったコードを貼って確定する）。確定時に局所 state をそのまま渡す。
function PasteBlock({
  label,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  label: string
  placeholder: string
  submitLabel: string
  onSubmit: (code: string) => void
}) {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  return (
    <div className="vs-pasteblock">
      <label className="vs-label">{label}</label>
      <textarea
        className="vs-code"
        rows={4}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="vs-btn vs-btn-primary vs-submit"
        disabled={trimmed.length === 0}
        onClick={() => onSubmit(trimmed)}
      >
        {submitLabel}
      </button>
    </div>
  )
}

export default function SignalingExchangeView({
  role,
  connection,
  selfId,
  offerCode,
  answerCode,
  shareUrl,
  activeIds,
  error,
  onSelectHost,
  onSelectGuest,
  onSubmitOffer,
  onSubmitAnswer,
  onCopy,
  onBack,
}: SignalingExchangeViewProps) {
  const badge = <span className={`vs-badge vs-${connection}`}>{CONNECTION_LABEL[connection]}</span>

  // 接続済み：カウントダウン/対戦画面は出さず（#425）、成立の確認と参加者一覧だけを見せる。
  if (connection === 'connected') {
    const ids = activeIds ?? []
    const others = ids.filter((id) => id !== selfId)
    return (
      <div className="vs">
        <header className="vs-header">
          <h2 className="vs-title">対戦</h2>
          {badge}
        </header>
        <p className="vs-connected-msg">接続しました。</p>
        <div className="vs-roster">
          <div className="vs-roster-head">参加者（{ids.length}）</div>
          <ul className="vs-roster-list">
            {ids.map((id) => (
              <li key={id} className={id === selfId ? 'vs-self' : ''}>
                {id === selfId ? 'あなた' : id}
              </li>
            ))}
          </ul>
          {others.length > 0 && (
            <p className="vs-partner">相手: {others.join('、')}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="vs">
      <header className="vs-header">
        <h2 className="vs-title">対戦</h2>
        {badge}
      </header>

      {error && <p className="vs-error" role="alert">{error}</p>}

      {/* 役割未選択：部屋を作る（ホスト）/ 入る（ゲスト）を選ぶ */}
      {role === null && (
        <div className="vs-roles">
          <p className="vs-lead">QR なしのコピペ／共有URLで、2人以上をつなぎます。</p>
          <div className="vs-role-buttons">
            <button type="button" className="vs-btn vs-btn-primary" onClick={onSelectHost}>
              部屋を作る
            </button>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={onSelectGuest}>
              部屋に入る
            </button>
          </div>
        </div>
      )}

      {/* ホスト手順：接続コードを渡す（コピー/共有URL）→ 相手の応答コードを貼って接続する */}
      {role === 'host' && (
        <div className="vs-flow">
          <ol className="vs-steps">
            <li>
              <div className="vs-step-title">1. このコードを相手に渡す</div>
              {offerCode ? (
                <>
                  <CodeBlock label="接続コード" value={offerCode} onCopy={onCopy} />
                  {shareUrl && onCopy && (
                    <button
                      type="button"
                      className="vs-btn vs-btn-secondary vs-share"
                      onClick={() => onCopy(shareUrl)}
                    >
                      共有URLをコピー
                    </button>
                  )}
                </>
              ) : (
                <p className="vs-pending">接続コードを生成中…</p>
              )}
            </li>
            <li>
              <div className="vs-step-title">2. 相手の応答コードを貼る</div>
              <PasteBlock
                label="応答コード"
                placeholder="相手から受け取った応答コードを貼り付け"
                submitLabel="接続する"
                onSubmit={onSubmitAnswer}
              />
            </li>
          </ol>
        </div>
      )}

      {/* ゲスト手順：接続コードを貼る→ 応答コードを相手に返す（answerCode が出たら返送フェーズ） */}
      {role === 'guest' && (
        <div className="vs-flow">
          {answerCode ? (
            <div className="vs-step">
              <div className="vs-step-title">この応答コードをホストに返す</div>
              <CodeBlock label="応答コード" value={answerCode} onCopy={onCopy} />
              <p className="vs-pending">ホストが受理すると接続されます。</p>
            </div>
          ) : (
            <div className="vs-step">
              <div className="vs-step-title">ホストの接続コードを貼る</div>
              <PasteBlock
                label="接続コード"
                placeholder="ホストから受け取った接続コードを貼り付け"
                submitLabel="応答コードを作る"
                onSubmit={onSubmitOffer}
              />
            </div>
          )}
        </div>
      )}

      {onBack && role !== null && connection !== 'connecting' && (
        <button type="button" className="vs-back" onClick={onBack}>
          ← 役割の選択に戻る
        </button>
      )}
    </div>
  )
}
