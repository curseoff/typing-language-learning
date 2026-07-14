// #399 保存状態バッジ: 保存状態（role/reason）→ バッジ表示（level/reasonCode）の写像。
// 純関数（DOM/infra/React 非依存・副作用なし・入力非破壊）。appMenu.policy と同方針で
// reasonCode は表示文言でなく安定コード（UI 側が文言へ写像する）。
//
// 方針：警告はノイズになるので「保存できていない」ときだけ warn を出す。
//   primary  … 保存中＝ok（reasonCode=null）
//   unknown  … 起動中・未確定＝ok（起動直後に警告を出さない。reasonCode='starting'）
//   secondary… 副タブは閲覧のみ＝warn（reasonCode='secondary'）
//   memory   … 非永続へ縮退＝warn。reason があればそのコード、無ければ 'not-saved' へフォールバック
//   未知 role … 安全側に倒し ok（余計な警告を出さない。reasonCode=null）
export function deriveSaveStatusBadge({ role, reason = null }) {
  switch (role) {
    case 'primary':
      return { level: 'ok', reasonCode: null }
    case 'unknown':
      return { level: 'ok', reasonCode: 'starting' }
    case 'secondary':
      return { level: 'warn', reasonCode: 'secondary' }
    case 'memory':
      return { level: 'warn', reasonCode: reason ?? 'not-saved' }
    default:
      return { level: 'ok', reasonCode: null }
  }
}
