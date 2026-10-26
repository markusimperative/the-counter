import type { NarrativeState } from './types'

export function firstOrderRecord(state: NarrativeState): string {
  const first = state.firstEncounter
  return first?.choiceId === 'NO_RESPONSE' ? 'FIRST CUSTOMER ASIDE · NO ORDER / NO QUOTATION'
    : first?.quotation ? 'Q-048 · UNPAID / UNSENT · 12:53 BACK'
      : first?.choiceId === 'A' ? '048 · HOT MEAL STILL WAITING' : '048 · WRAP COLLECTED'
}
export function firstOutcomeSummary(state: NarrativeState): string {
  const id = state.firstEncounter?.choiceId
  return id === 'NO_RESPONSE' ? 'No response. The first customer stepped aside without an order, payment or food. Their exact deadline was never learned.'
    : id === 'A' ? 'Order 048 remains delayed. The first customer waits near pickup.'
      : id === 'B' ? 'Q-048 remains unpaid and unsent. The first customer stands aside; back at work at 12:53.'
        : 'The first customer left with the ready wrap. That transaction is complete.'
}
