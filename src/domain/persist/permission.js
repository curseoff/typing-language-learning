// FSA（File System Access）権限状態→次アクションの純判定（domain・DOM/infra/FSA 非依存・副作用なし）。
// #274 L-2: application から domain へ移設（infra→application の逆流を解消。infra も application も
// domain を内向きに参照する正しい向きへ）。permission.test.js で被覆＝計測対象。
//
// FSA queryPermission の結果（'granted'|'prompt'|'denied'）から次アクションを決める：
//   'granted'→'write'（そのまま書ける）／'prompt'→'request'（requestPermission を促す）／
//   それ以外（'denied'・未知文字列・null・undefined・空文字・非文字列）は安全側で 'skip'（書かない）。
// 常に 'write'|'request'|'skip' のいずれかを返す（boolean 等は返さない）。
export function decidePermissionAction(state) {
  if (state === 'granted') return 'write'
  if (state === 'prompt') return 'request'
  return 'skip'
}
