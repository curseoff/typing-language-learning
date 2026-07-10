// #290 Phase 7: イベントバス（同期・in-memory）。
//   発行側（publish）と購読側（subscribe）を疎結合にする同期イベントバス。
//   発行側は「誰が反応するか」を知らない＝反応の追加は subscribe 側だけで完結する。
//   type ごとに購読 handler を挿入順（＝購読順）で保持し、publish 時に同期で呼ぶ。

export function createEventBus() {
  // type -> Set<handler>（Set は挿入順を保つので購読順に呼べる）。
  const handlers = new Map()

  // 購読を登録し、その handler だけを解除する unsubscribe を返す。
  function subscribe(type, handler) {
    let set = handlers.get(type)
    if (!set) {
      set = new Set()
      handlers.set(type, set)
    }
    set.add(handler)
    return function unsubscribe() {
      set.delete(handler)
    }
  }

  // event.type を購読する全 handler を購読順で同期呼び出しする（該当なしは no-op）。
  function publish(event) {
    const set = handlers.get(event.type)
    if (!set) return undefined
    for (const handler of set) handler(event)
    return undefined
  }

  return { subscribe, publish }
}
