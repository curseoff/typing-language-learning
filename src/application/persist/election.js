// #273 Phase3b: Web Locks 主タブ選出の状態遷移（純関数・DOM/infra 非依存）。
// 方式③：Web Locks で主タブを1つ選び、副タブは read-only（snapshot 閲覧）。
//   state = { role:'unknown'|'primary'|'secondary', epoch:number }
//   event = { type:'lock-granted' } | { type:'lock-unavailable' } | { type:'promote-granted' }
// 不変条件：入力 state を破壊しない（常に新オブジェクト）／primary 化のたび epoch を +1（単調増加）／
//   生存中の降格なし（primary は全 event で primary 維持）。epoch は「新主が生まれた世代」の単調カウンタ。
export function electionTransition(state, event) {
  const { role, epoch } = state
  const type = event && event.type

  // primary は生存中は降格しないし重複昇格もしない（全 event で冪等）。
  if (role === 'primary') return { role, epoch }

  if (role === 'unknown') {
    // 初期選出：ロック獲得で主に確定（epoch+1）、獲得不可なら副に回る（epoch 据え置き）。
    if (type === 'lock-granted') return { role: 'primary', epoch: epoch + 1 }
    if (type === 'lock-unavailable') return { role: 'secondary', epoch }
    return { role, epoch }
  }

  // role === 'secondary'
  // handoff 昇格は promote-granted 経由のみ（epoch+1）。それ以外は secondary のまま据え置き
  // （lock-unavailable は冪等・lock-granted は通常来ない想定で無視）。
  if (type === 'promote-granted') return { role: 'primary', epoch: epoch + 1 }
  return { role, epoch }
}
