import type { NarrativeState } from '../narrative/types'

/** Describe known conditions only; narrative actions and timing remain in the reducer. */
export function immediateSituation(state: NarrativeState): string {
  if (state.chapter === 1) return 'About ten minutes. Meal estimate: eight; wrap ready.'
  if (state.chapter === 2) return 'Three meals paid. They asked you not to send them.'
  const prior = state.secondEncounter?.choiceId
  return prior === 'B' ? 'Two meals now. The original order was refunded.'
    : prior === 'C' ? 'Two meals now. Three are still on hold.'
      : 'Two meals now. Three are still paid and unsent.'
}

export function currentOrderFacts(state: NarrativeState): string {
  const c = state.correction
  if (state.chapter === 3 && c) {
    const order = c.order
    return order ? `Order ${order.number}: ${order.items.length} meals · €${(order.totalCents / 100).toFixed(2)} ${order.payment} · ${order.release === 'held' ? 'on kitchen HOLD' : order.release}. Preparation has not started; nothing has been collected.`
      : 'Original order 049 was refunded: €25.00 returned. There is no active order or kitchen ticket.'
  }
  const order = state.pauseOrder
  if (state.chapter === 2 && order) return `Order ${order.number}: three meals · €${order.total.toFixed(2)} ${order.payment} · ${order.release === 'sent' ? 'kitchen HOLD; do not prepare' : 'not sent to the kitchen'}. ${order.refund === 'complete' ? 'Refund complete. No active order.' : 'Preparation has not started.'}`
  if (state.firstEncounter?.quotation || state.orderStatus === 'pending') return 'Hot meal pending; unpaid and unsent. No kitchen order has been placed.'
  return state.orderStatus === 'delayed' ? 'Order 048 is delayed. Its receipt retains the original eight-minute estimate.'
    : state.orderStatus === 'entered' ? 'Order 048 has been entered with an eight-minute estimate.'
      : state.orderStatus === 'handed-off' ? 'The ready chicken wrap has been handed over.'
        : state.orderStatus === 'ready' ? 'The ready chicken wrap is selected for handoff.'
          : 'No order has been placed. The exact return-to-work deadline is unknown.'
}

export function pendingWork(state: NarrativeState): string {
  const c = state.correction
  if (!c) return state.chapter === 2 ? state.pauseOrder?.request ? 'The third meal is unconfirmed. Leaving this paid order open occupies the register; refunding closes it; a HOLD ticket reaches the kitchen without starting preparation.' : 'The order is paid but unsent. No further request has been established yet.' : 'An estimate is not a guarantee. The customer’s travel time is unknown.'
  if (!c.request) return 'A reply is arriving. No revised request has been established yet.'
  if (c.handoff?.accepted) return 'Your colleague has accepted responsibility. ' + c.handoff.remainingActions.join('; ') + '. The correction is unfinished.'
  if (c.status === 'released') return 'The two-meal order is released. Preparation and collection have not occurred.'
  if (c.status === 'awaiting-payment') return 'Draft 050 is unpaid and unsent. Fresh €17.20 payment authorization and permission to release are still needed.'
  if (c.status === 'awaiting-release') return 'The vegetable meal is removed and €7.80 returned. Permission to release the two meals is still needed.'
  if (c.priorChoice === 'B') return 'A new two-meal order, fresh €17.20 payment authorization and permission to release are needed. The original refund cannot be undone.'
  return (c.priorChoice === 'C' ? 'Amend the three-meal HOLD ticket; ' : 'Remove the vegetable meal; ') + 'return €7.80 and obtain permission to release. A request for context does not transfer responsibility.'
}
