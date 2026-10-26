import type { NarrativeState, TransactionEntry } from '../narrative/types'
import { correctionSummary, euros, inheritedSummary } from '../narrative/revision'
import { firstOrderRecord, firstOutcomeSummary } from '../narrative/summaries'

export function CorrectionFacts({ state }: { state: NarrativeState }) {
  const prior = state.secondEncounter?.choiceId
  return <dl className="operational-facts correction-facts" aria-label="Order history, revised request and constraints">
    <div><dt>Original / previous action</dt><dd>049 · two chicken meals, one vegetable meal. {inheritedSummary(state)}.</dd></div>
    <div><dt>New request · 12:49</dt><dd>Keep two chicken meals: €17.20. Remove the vegetable meal: €7.80.</dd></div>
    <div><dt>Still needed</dt><dd>{prior === 'A' || prior === 'NO_RESPONSE' ? '€7.80 adjustment and permission to release. Register occupied until correction or an accepted handoff.' : prior === 'B' ? 'A new order and fresh €17.20 payment authorization. The refund cannot be undone.' : 'Amend the HOLD ticket, return €7.80 and confirm release. No preparation has started.'}</dd></div>
  </dl>
}

function ledgerLabel(entry: TransactionEntry): string {
  const id = String(entry.order).padStart(3, '0')
  switch (entry.type) {
    case 'payment': return `${id} PAID ${euros(entry.cents!)}`
    case 'refund': return `${id} REFUND ${euros(entry.cents!)}`
    case 'draft-created': return `${id} NEW DRAFT ${euros(entry.cents!)} · UNPAID`
    case 'ticket-created': return `${id} TICKET · ${entry.items} MEALS${entry.items === 3 ? ' · ORIGINAL HOLD' : ''}`
    case 'ticket-amended': return `${id} AMENDMENT 1 · 2 MEALS`
    case 'ticket-released': return `${id} RELEASED · 2 MEALS`
    case 'customer-authorization': return `${id} CUSTOMER AUTHORIZATION`
    case 'handoff': return 'COLLEAGUE ACCEPTED · WORK PENDING'
  }
}

export function CorrectionTerminal({ state }: { state: NarrativeState }) {
  const c = state.correction!
  const order = c.order
  const items = order?.items ?? state.secondEncounter!.order.items.map(item => ({ name: item.name, cents: Math.round(item.amount * 100) }))
  return <>
    <div className="terminal-heading"><span>MORROW</span><i /><span>{order ? `ORDER ${String(order.number).padStart(3, '0')}` : 'ARCHIVE 049'}</span></div>
    <div className="pause-order-status">{c.status === 'handed-over' ? 'With colleague' : !order ? 'Refunded · no order' : order.payment === 'unpaid' ? 'Draft · unpaid' : order.release === 'released' ? 'Two meals · released' : order.release === 'held' ? 'Kitchen HOLD' : 'Paid · not sent'}</div>
    <div className="order-items">{items.map((item, index) => <div key={index}><span>{index + 1}. {item.name}</span><span>{euros(item.cents)}</span></div>)}</div>
    <div className="order-payment"><span>{!order ? 'REFUNDED' : order.payment.toUpperCase()}</span><strong>{euros(order?.totalCents ?? 2500)}</strong></div>
    <div className="order-release">{!order ? 'NO ACTIVE ORDER · NO TICKET' : order.release === 'held' ? `HOLD ${order.items.length} · DO NOT PREPARE` : order.release === 'released' ? 'RELEASED · PREPARATION NOT STARTED' : 'UNSENT · NO KITCHEN TICKET'}</div>
    <div className="revision-status">{c.status === 'handed-over' ? 'CORRECTION PENDING · COLLEAGUE OWNS WORK' : c.status === 'awaiting-payment' ? 'FRESH PAYMENT AUTHORIZATION NEEDED' : c.status === 'awaiting-release' ? 'RELEASE PERMISSION NEEDED' : c.status === 'released' ? 'NOT PREPARED · NOT COLLECTED' : c.request ? 'REQUEST: TWO CHICKEN MEALS · €17.20' : 'AWAITING REPLY'}</div>
    {c.status === 'unanswered' && <div className="revision-status">NO RESPONSE · INTERVENTION ONLY · YOU STILL OWN WORK</div>}
    {c.status === 'handed-over' && <div className="revision-status">REQUEST: TWO CHICKEN MEALS · €17.20</div>}
    <div className="transaction-history-label">TRANSACTION HISTORY · 12:46 → 12:49</div>
    <ol className="transaction-history" aria-label="Transaction and ticket history">{c.ledger.map(entry => <li key={entry.id} title={entry.detail}>{ledgerLabel(entry)}</li>)}</ol>
    <div className="previous-order-record">{firstOrderRecord(state)}</div>
    <div className="terminal-bottom"><span>REGISTER {state.register === 'free' ? 'AVAILABLE' : 'OCCUPIED'}</span><span>GRILL 13 MIN</span></div>
  </>
}

export function ShiftTrace({ state }: { state: NarrativeState }) {
  return <ol className="shift-trace" tabIndex={0} aria-label="The three decisions and their remaining traces">
    <li><span>01 · THE LUNCH RUSH</span><p>{firstOutcomeSummary(state)}</p></li>
    <li><span>02 · THE PAUSE</span><p>{state.secondEncounter?.choiceId === 'NO_RESPONSE' ? 'No response. €25.00 stayed paid, three meals unsent and the register occupied. A colleague intervened; no informed handoff occurred.' : state.secondEncounter?.choiceId === 'A' ? 'Kept €25.00 paid and three meals unsent. The register stayed occupied.' : state.secondEncounter?.choiceId === 'B' ? 'Refunded €25.00. Order 049 closed without a kitchen ticket.' : 'Sent ticket 049 with three meals on HOLD despite the request to leave it unsent. No preparation started.'}</p></li>
    <li><span>03 · THE CORRECTION</span><p>{correctionSummary(state)}</p></li>
  </ol>
}
