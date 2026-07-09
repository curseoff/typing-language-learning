// #286 メニューバー Phase1(PC): macOS/Chrome 風のトップメニューバー（presenter）。
// 純粋描画＋外側クリック/Esc で閉じるだけの薄い DOM 副作用（開閉状態・ハンドラは container が持つ）。
// infra 非依存。項目の可否（enabled）と理由文言（reason＝表示済みの日本語）は props で受け取り、
// disabled 項目は押下不可＋理由を title/補助テキストで示す（メニューは隠さず常に見せる方針）。
// キーボード全経路（矢印移動/タイプアヘッド）は Phase3。ここでは button/aria-* だけ正しく付ける。
import { useEffect, useRef } from 'react'

export interface MenuBarItem {
  id: string
  label: string
  icon?: string
  enabled: boolean
  reason?: string | null // 表示用の日本語（不可の理由）。null/未指定なら理由なし。
}

export interface MenuBarMenu {
  id: string
  label: string
  items: MenuBarItem[]
}

export interface MenuBarViewProps {
  appName: string
  menus: MenuBarMenu[]
  openId: string | null
  onToggle: (id: string) => void
  onSelect: (itemId: string) => void
  onClose: () => void
}

export default function MenuBarView({
  appName,
  menus,
  openId,
  onToggle,
  onSelect,
  onClose,
}: MenuBarViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  // 開いている間だけ、外側クリック（mousedown）と Esc で閉じる。開閉状態そのものは container が持つ。
  useEffect(() => {
    if (openId === null) return
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openId, onClose])

  return (
    <div className="menu-bar" role="menubar" aria-label={appName} ref={rootRef}>
      {menus.map((menu, i) => {
        const open = openId === menu.id
        return (
          <div className="menu-bar__item" key={menu.id}>
            <button
              type="button"
              className={`menu-bar__trigger${i === 0 ? ' menu-bar__trigger--brand' : ''}`}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => onToggle(menu.id)}
              // 別メニューが開いている間は、ホバーで開き先を切り替える（macOS/Chrome の挙動）。
              onMouseEnter={() => {
                if (openId !== null && openId !== menu.id) onToggle(menu.id)
              }}
            >
              {menu.label}
            </button>
            {open && (
              <ul className="menu-bar__dropdown" role="menu" aria-label={menu.label}>
                {menu.items.map((item) => (
                  <li className="menu-bar__li" role="none" key={item.id}>
                    <button
                      type="button"
                      className="menu-bar__option"
                      role="menuitem"
                      disabled={!item.enabled}
                      title={!item.enabled && item.reason ? item.reason : undefined}
                      // 発火は enabled のときだけ（disabled 属性の保険としても二重に守る）。
                      onClick={() => item.enabled && onSelect(item.id)}
                    >
                      {item.icon && (
                        <span className="menu-bar__option-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      <span className="menu-bar__option-label">{item.label}</span>
                      {!item.enabled && item.reason && (
                        <span className="menu-bar__option-reason">{item.reason}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
