import { revisedRequest } from './correction.ts'
import type { CorrectionOrder, CorrectionState, NarrativeState, PlayerAction, SecondEncounterRecord, TransactionEntry } from './types'

export const euros = (cents: number) => '€' + (cents / 100).toFixed(2)
const twoMeals = () => [{ name: 'Hot chicken meal', cents: 860 }, { name: 'Hot chicken meal', cents: 860 }]
const append = (ledger: TransactionEntry[], entry: TransactionEntry) => ledger.some(old => old.id === entry.id) ? ledger : [...ledger, entry]

export function initializeCorrection(record: SecondEncounterRecord): CorrectionState {
  const prior = record.order
  const ledger: TransactionEntry[] = [{ id: '049-payment', type: 'payment', order: 49, cents: 2500, detail: 'Original three-meal payment at 12:46.' }]
  if (prior.refund === 'complete') ledger.push({ id: '049-full-refund', type: 'refund', order: 49, cents: 2500, detail: 'Chapter II refund completed. Payment cannot be restored.' })
  if (prior.release === 'sent') ledger.push({ id: '049-ticket', type: 'ticket-created', order: 49, items: 3, detail: 'Three meals sent despite the request; HOLD ALL. No preparation.' })
  return {
    priorChoice: record.choiceId, request: null,
    order: prior.payment === 'refunded' ? null : {
      number: 49, items: prior.items.map(item => ({ name: item.name, cents: Math.round(item.amount * 100) })), totalCents: 2500,
      payment: 'paid', release: prior.release === 'sent' ? 'held' : 'unreleased', preparation: 'not-started', collection: 'not-collected',
    },
    status: 'awaiting-reply', authorization: { change: false, newPayment: false, release: false }, ledger, owner: 'you', handoff: null,
  }
}

export function receiveCorrectionReply(state: NarrativeState): NarrativeState {
  const correction = state.correction
  if (!correction || correction.request) return state
  return { ...state, correction: { ...correction, status: 'requested', request: { text: revisedRequest, chickenMeals: 2, totalCents: 1720, removedCents: 780 }, authorization: { ...correction.authorization, change: true } } }
}

export function authorizeCorrection(state: NarrativeState, line: string): NarrativeState {
  const c = state.correction
  if (state.chapter !== 3 || state.phase !== 'consequence' || !c?.request || c.owner !== 'you' || c.authorization.release || (c.priorChoice === 'B' && state.selectedChoice !== 'A')) return state
  return {
    ...state, eventLog: [...state.eventLog, { source: 'customer', fact: 'correction-authorized' }],
    correction: { ...c, authorization: { change: true, release: true, newPayment: c.priorChoice === 'B' }, ledger: append(c.ledger, { id: 'correction-authorization', type: 'customer-authorization', order: c.priorChoice === 'B' ? 50 : 49, detail: line }) },
  }
}

/** Removal is requested by the customer; release and any fresh payment need separate consent. */
function correctDraft(c: CorrectionState): CorrectionState {
  if (c.priorChoice === 'B') {
    if (c.order) return c
    const order: CorrectionOrder = { number: 50, items: twoMeals(), totalCents: 1720, payment: 'unpaid', release: 'unreleased', preparation: 'not-started', collection: 'not-collected' }
    return { ...c, order, status: 'awaiting-payment', ledger: append(c.ledger, { id: '050-draft', type: 'draft-created', order: 50, cents: 1720, items: 2, detail: 'New saved draft. No charge, authorization or kitchen ticket.' }) }
  }
  if (!c.order || c.order.totalCents === 1720) return c
  let ledger = append(c.ledger, { id: '049-adjustment', type: 'refund', order: 49, cents: 780, detail: 'Vegetable meal removed at the customer’s request. €7.80 returned.' })
  if (c.priorChoice === 'C') ledger = append(ledger, { id: '049-amendment', type: 'ticket-amended', order: 49, items: 2, detail: 'Amendment 1: remove vegetable meal. Original three-meal ticket retained; HOLD continues.' })
  return { ...c, order: { ...c.order, items: twoMeals(), totalCents: 1720 }, status: 'awaiting-release', ledger }
}

export function applyCorrectionAction(state: NarrativeState, action: PlayerAction): NarrativeState {
  const original = state.correction
  if (state.chapter !== 3 || state.phase !== 'consequence' || !original?.request || original.status === 'released' || original.status === 'handed-over') return state
  let c = original
  let register = state.register
  let queue = state.queue
  switch (action) {
    case 'explain-correction': c = { ...c, status: 'explaining' }; break
    case 'begin-correction': c = correctDraft(c); break
    case 'complete-correction': {
      if (!c.authorization.release || !c.authorization.change || (c.priorChoice === 'B' && !c.authorization.newPayment)) return state
      c = correctDraft(c)
      if (!c.order) return state
      const number = c.order.number
      let ledger = c.ledger
      if (c.priorChoice === 'B') ledger = append(ledger, { id: '050-payment', type: 'payment', order: 50, cents: 1720, detail: 'Fresh €17.20 payment, explicitly authorized by the customer.' })
      if (c.priorChoice !== 'C') ledger = append(ledger, { id: number + '-ticket', type: 'ticket-created', order: number, items: 2, detail: 'Two-meal ticket created after customer authorization.' })
      ledger = append(ledger, { id: number + '-release', type: 'ticket-released', order: number, items: 2, detail: 'Two chicken meals released after explicit confirmation. Preparation not started.' })
      c = { ...c, ledger, order: { ...c.order, payment: 'paid', release: 'released' }, status: 'released' }
      register = 'free'; queue = { ...queue, nextServed: true, flow: 'moving' }
      break
    }
    case 'prepare-handoff': {
      const prior = state.secondEncounter?.order
      if (!prior) return state
      const remainingActions = c.priorChoice === 'B'
        ? ['Confirm a new two-meal order', 'Obtain fresh €17.20 payment authorization', 'Obtain release permission']
        : [c.priorChoice === 'C' ? 'Confirm amendment to ticket 049' : 'Confirm removal of the vegetable meal', 'Return €7.80', 'Obtain release permission']
      c = { ...c, status: 'handoff-offered', handoff: { originalRequest: prior.request!.text, priorChoice: c.priorChoice, payment: prior.payment, ticket: prior.release === 'sent' ? 'held' : 'none', revisedRequest: c.request!.text, remainingActions, accepted: false } }
      break
    }
    case 'accept-handoff': {
      if (!c.handoff || c.handoff.accepted) return state
      c = { ...c, owner: 'colleague', status: 'handed-over', handoff: { ...c.handoff, accepted: true }, ledger: append(c.ledger, { id: 'correction-handoff', type: 'handoff', order: c.order?.number ?? 49, detail: 'Colleague accepts original request, transaction/ticket history, revised request and outstanding actions. Correction unfinished.' }) }
      register = 'free'; queue = { ...queue, nextServed: true, flow: 'moving' }
      break
    }
    default: return state
  }
  if (c === original) return state
  return { ...state, correction: c, register, queue, eventLog: [...state.eventLog, { source: 'player', action }] }
}

export function inheritedSummary(state: NarrativeState): string {
  const prior = state.secondEncounter?.choiceId
  if (prior === 'NO_RESPONSE') return 'No response · €25.00 paid · three meals unsent · register occupied · colleague intervention only'
  return prior === 'A' ? 'Kept open · €25.00 paid · three meals unsent · register occupied'
    : prior === 'B' ? '€25.00 refunded · no active order or kitchen ticket'
      : '€25.00 paid · ticket 049 holds three meals · no preparation'
}

export function correctionSummary(state: NarrativeState): string {
  const c = state.correction
  if (!c) return ''
  if (c.status === 'unanswered') return 'No response to the revised request. ' + inheritedSummary(state) + '. You still own the unresolved work. The colleague asked for context; no handoff, adjustment, payment, amendment or release occurred.'
  if (c.status === 'handed-over') return 'Colleague owns the correction. ' + (c.order ? `Three meals ${c.order.release === 'held' ? 'on HOLD' : 'unreleased'}; €25.00 paid. Change and €7.80 adjustment pending.` : '€25.00 remains refunded; no active order. Fresh order, payment and release still pending.')
  if (c.status === 'released') return `Order ${c.order!.number} · two chicken meals · €17.20 paid · released. Not prepared or collected.`
  if (c.status === 'awaiting-payment') return 'Draft 050 · two chicken meals · €17.20 unpaid and unsent. Fresh payment authorization pending.'
  return inheritedSummary(state)
}
