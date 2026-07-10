// #286 メニューバー新設 Phase1: 能力（caps）→トップメニュー各項目の
// 可視/理由の写像。純関数（DOM/infra/React 非依存・副作用なし・入力非破壊）。
// reason は表示文言でなく安定コード（UI 側が文言へ写像する）。
// 方針：メニューは隠さず常に表示し、不可時は disabled＋理由コードを添える。
export function buildTopMenuVisibility(caps) {
  const hasHandle = !!(caps && caps.hasHandle)
  const supportsFsa = !!(caps && caps.supportsFsa)
  const installable = !!(caps && caps.installable)

  // sqlite 主タブ（ハンドル）を要する項目。無ければ need-sqlite-primary。
  const needsHandle = {
    enabled: hasHandle,
    reason: hasHandle ? null : 'need-sqlite-primary',
  }

  // 外部（FSA）連携。ハンドル無しを FSA 非対応より優先して理由に出す。
  const external = {
    enabled: hasHandle && supportsFsa,
    reason: !hasHandle ? 'need-sqlite-primary' : !supportsFsa ? 'need-fsa' : null,
  }

  return {
    data: {
      export: { ...needsHandle },
      import: { ...needsHandle },
      connectExternal: { ...external },
      restoreExternal: { ...external },
    },
    help: {
      about: { enabled: true, reason: null },
      install: {
        enabled: installable,
        reason: installable ? null : 'not-installable',
      },
    },
  }
}
