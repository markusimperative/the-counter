import type { CSSProperties, ReactNode } from 'react'
import { publicAsset } from '../assets'
import { currentBeat, formatStoryTime } from '../narrative/engine'
import { sceneForId } from '../narrative/story'
import type { CustomerPose, NarrativeState } from '../narrative/types'
import { CorrectionTerminal } from './CorrectionDisplay'
import { firstOrderRecord } from '../narrative/summaries'
import './scene-queue.css'

const firstPoses: CustomerPose[] = ['watch', 'neutral', 'concern', 'clarify', 'accept']
const pausePoses: CustomerPose[] = ['neutral', 'phone', 'explain']
function QueuePerson({ className, person, description, hidden = false }: { className: string; person: 'first' | 'second' | 'middle' | 'far' | 'third'; description: string; hidden?: boolean }) {
  return <div className={'queue-person ' + className} aria-hidden={hidden}>
    <img src={publicAsset('art/queue-' + person + '.webp')} alt={hidden ? '' : description} draggable="false" />
  </div>
}
function Clock({ minutes, seconds, mobile = false }: { minutes: number; seconds?: number; mobile?: boolean }) {
  const [time, period] = formatStoryTime(minutes, seconds).split(' ')
  return <div className={'physical-clock ' + (mobile ? 'mobile-clock' : '') + (seconds !== undefined ? ' clock-seconds' : '')} aria-label={'Restaurant clock: ' + formatStoryTime(minutes, seconds)}><span>{time}</span><small>{period}</small></div>
}
function TerminalShell({ children, chapter = 1 }: { children: ReactNode; chapter?: number }) {
  return <section className={'terminal terminal-chapter-' + chapter + (chapter >= 2 ? ' terminal-paid-order' : '')} aria-label="Ordering terminal" data-testid="terminal">
    <div className="terminal-case"><div className="terminal-screen">{children}</div><div className="terminal-bezel"><span />morrow</div></div>
    <div className="terminal-stand" /><div className="terminal-base" />
  </section>
}
function Terminal({ state }: { state: NarrativeState }) {
  if (state.chapter === 3 && state.correction) return <TerminalShell chapter={3}><CorrectionTerminal state={state} /></TerminalShell>
  const order = state.pauseOrder
  if (state.chapter === 2) return <TerminalShell chapter={2}>
    <div className="terminal-heading"><span>MORROW</span><i /><span>ORDER 049</span></div>
    <div className="pause-order-status">{!order ? 'New transaction' : order.refund === 'complete' ? 'Refund complete' : order.release === 'sent' ? 'Ticket on hold' : 'Paid · not sent'}</div>
    <div className="order-items">{order?.items.map((item, index) => <div key={index}><span>{index + 1}. {item.name}</span><span>{item.amount.toFixed(2)}</span></div>)}</div>
    <div className="order-payment"><span>{order?.refund === 'complete' ? 'REFUNDED' : order?.payment === 'paid' ? 'PAID' : 'TOTAL'}</span><strong>{(order?.total ?? 25).toFixed(2)}</strong></div>
    <div className="order-release">{order?.release === 'sent' ? 'HOLD ALL 3 · DO NOT PREPARE' : 'NO KITCHEN TICKET'}</div>
    {order?.request && <div className="order-request">Request: leave unsent{order.request.sentDespiteRequest ? ' · ticket sent' : ''}</div>}
    {state.firstEncounter && <div className="previous-order-record">{firstOrderRecord(state)}</div>}
    <div className="terminal-bottom"><span>{state.register === 'occupied' ? 'REGISTER OCCUPIED' : 'REGISTER AVAILABLE'}</span><span>GRILL {state.kitchen.estimateMinutes} MIN</span></div>
  </TerminalShell>
  const delayed = state.orderStatus === 'delayed'
  const ready = state.orderItem === 'chicken-wrap'
  const pending = state.orderStatus === 'pending'
  const collected = state.orderStatus === 'handed-off'
  const savedQuote = Boolean(state.firstEncounter?.quotation)
  return <TerminalShell>
    <div className="terminal-heading"><span>MORROW</span><i /><span>{state.orderStatus === 'unplaced' ? 'NEW ORDER' : pending ? savedQuote ? 'SAVED Q-048' : 'PENDING' : 'ORDER 048'}</span></div>
    <div className="terminal-estimate-label">{collected ? 'CHICKEN WRAP' : ready ? 'READY TO GO' : 'ESTIMATED PREPARATION'}</div>
    <div className="terminal-estimate" data-testid="estimate">{collected ? 'Collected' : ready ? 'Ready now' : <>{state.preparationEstimate}<small> min</small></>}</div>
    {state.customerDeadline ? <div className="terminal-deadline"><span>BACK AT WORK</span><strong>{state.customerDeadline.time} PM</strong></div>
      : <div className="terminal-alternative"><span className="availability-dot" />{ready ? 'Chicken wrap · 1 item' : 'Chicken wrap available now'}</div>}
    <div className="terminal-bottom"><span>{delayed ? 'IN KITCHEN · GRILL HOLD' : pending ? savedQuote ? 'UNPAID · UNSENT' : 'PENDING · NOT SENT' : collected ? 'HANDED OVER' : ready ? 'READY FOR HANDOFF' : state.orderStatus === 'entered' ? 'SENT TO KITCHEN' : 'AWAITING ORDER'}</span><span>● ● ●</span></div>
  </TerminalShell>
}

export function Scene({ state, look, performance }: { state: NarrativeState; look: { x: number; y: number }; performance: { pose: CustomerPose; gesture: string; camera: string } }) {
  const beat = currentBeat(state)
  const scene = sceneForId(state.sceneId)
  const secondChapter = state.chapter >= 2
  const pose = state.phase === 'opening' ? secondChapter ? 'neutral' : 'watch' : performance.pose
  const showCustomer = state.phase !== 'title'
  const hasQueue = state.queue.second !== 'offstage'
  const handoff = !secondChapter && (beat?.cue === 'handoff' || (state.phase === 'transition' && state.selectedChoice === 'C'))
  const style = { '--look-x': look.x + 'px', '--look-y': look.y + 'px', '--opening-duration': scene.openingDuration + 'ms' } as CSSProperties
  const prefix = secondChapter ? 'pause' : 'customer'
  const poses = secondChapter ? pausePoses : firstPoses
  const prior = state.firstEncounter
  const priorPose = prior?.choiceId === 'A' ? 'concern' : 'clarify'
  const revision = state.chapter === 3 ? state.correction : null
  const revisionOrder = revision?.order
  const revisionTicket = revision?.ledger.find(entry => entry.type === 'ticket-created')?.order
  const hasTicket = revision ? Boolean(revisionTicket) : state.pauseOrder?.release === 'sent'
  const kitchenDescription = `Kitchen order display. Grill estimate ${state.kitchen.estimateMinutes} minutes. ${state.receipt ? 'Order 048 ' + state.orderStatus + '. ' : 'No order 048 in kitchen. '}${revision ? revisionTicket ? `Ticket ${revisionTicket}. ${revisionOrder?.items.length} meals. ${revisionOrder?.release === 'held' ? 'HOLD. ' : 'Released. '}Preparation not started. ${revision.ledger.some(entry => entry.type === 'ticket-amended') ? 'Original three-meal ticket and amendment retained.' : ''}` : 'No ticket for the revised order.' : secondChapter ? hasTicket ? 'Order 049 ticket received. HOLD all three items. Preparation not started.' : 'No order 049 in kitchen.' : ''}`
  return <div className={'stage stage-' + state.phase + (secondChapter ? ' second-encounter' : '') + (state.queue.nextServed ? ' queue-moving' : '') + (state.decision?.firedCueIds.length && state.phase === 'decision' ? ' waiting-shift' : '') + (!secondChapter && state.selectedChoice === 'NO_RESPONSE' ? ' customer-steps-aside' : '')} style={style} aria-hidden={state.phase === 'ending'} aria-label="First-person view from behind the counter at Morrow">
    <div className={'world ' + (performance.camera === 'notice' ? 'camera-notice' : '')}>
      <img className="environment" src={publicAsset('art/restaurant.webp')} alt="A warm, sunlit restaurant with a cool open kitchen, amber booths, and a terrazzo service counter." draggable="false" />
      <div className="sunlight" />
      <div className="menu-boards" aria-hidden="true">
        <div><span>FROM THE GRILL</span><b>The hot chicken meal</b><small>Roasted chicken · fries · slaw</small><em>8.60</em></div>
        <div><span>A LITTLE LIGHTER</span><b>Chicken & greens wrap</b><small>Freshly made. Ready to go.</small><em>5.40</em></div>
        <div><span>MAKE A MOMENT</span><b>Something on the side</b><small>House lemonade · good coffee</small><em>From 2.20</em></div>
      </div>
      <Clock minutes={state.storyTimeMinutes} seconds={state.mode === 'timed' ? state.storyTimeSeconds : undefined} />
      <div className="restaurant-sign" aria-hidden="true"><span className="sun-mark">✳</span><strong>morrow</strong><small>GOOD FOOD. EVERY DAY.</small></div>
      <div className="kitchen-board" aria-label={kitchenDescription}>
        <span className="kitchen-board-label">{secondChapter ? 'COLLECT / KITCHEN TICKETS' : 'COLLECT / PREPARING'}</span>
        <div>{state.kitchen.calledOrder && <strong>{String(state.kitchen.calledOrder).padStart(3, '0')}</strong>}{state.kitchen.calledOrder !== 46 && <span>046</span>}{state.receipt && <span>048</span>}{hasTicket && <span className="held-ticket-number">{String(revisionTicket ?? 49).padStart(3, '0')}</span>}</div>
        <small className={state.kitchen.grillStatus === 'backed-up' ? 'delay-message' : ''}>{state.kitchen.grillStatus === 'backed-up' ? 'GRILL HOLD' : 'HOT ORDERS'} · {state.kitchen.estimateMinutes} MIN</small>
        {hasTicket && <small className="kitchen-hold-label">{revision ? `${String(revisionTicket).padStart(3, '0')} ${revisionOrder?.release === 'held' ? 'HOLD · DO NOT PREPARE' : 'RELEASED · NOT STARTED'}` : '049 HOLD · DO NOT PREPARE'}</small>}
        {revision?.ledger.some(entry => entry.type === 'ticket-amended') && <small className="kitchen-amendment">AMENDMENT 1 · TWO MEALS</small>}
      </div>
      <div className="kitchen-steam steam-one" /><div className="kitchen-steam steam-two" />
      {secondChapter && <>
        <QueuePerson className="queue-person-far" person="far" description="Farther back, a customer with a shopping list glances toward the entrance." />
        <QueuePerson className="queue-person-middle" person="middle" description="A customer with a shoulder bag waits behind the next person in line." />
      </>}
      <QueuePerson className={'queue-person-first ' + (state.queue.first === 'left' ? 'queue-collected' : '')} person="first" description="A customer waits to collect order 47." hidden={state.queue.first === 'left'} />
      <QueuePerson className={'queue-person-second ' + (hasQueue ? 'joined' : '') + (state.queue.second === 'advanced' ? ' queue-advanced' : '')} person="second" description={state.queue.nextServed ? 'The next customer advances to the available register.' : 'Another customer waits in the queue.'} hidden={!hasQueue} />
      {secondChapter && <QueuePerson className={'queue-person-third ' + (state.queue.arrivals > 0 ? 'joined' : '')} person="third" description="A new customer joins the growing queue." hidden={state.queue.arrivals === 0} />}
      {secondChapter && prior && prior.location !== 'left' && <img className={'previous-customer previous-customer-' + prior.location + (prior.choiceId === 'NO_RESPONSE' ? ' previous-customer-unanswered' : '')} src={publicAsset('art/customer-' + priorPose + '.webp')} alt={prior.location === 'pickup' ? 'The first customer waits near pickup for the delayed hot meal.' : prior.choiceId === 'NO_RESPONSE' ? 'The first customer stands aside without an order or food. Their exact return-to-work time remains unknown.' : 'The first customer stands aside to consider their saved unpaid quotation.'} draggable="false" />}
      <div key={state.chapter} className={'customer ' + (showCustomer ? 'customer-present' : '')} aria-label={showCustomer ? 'Customer: ' + (secondChapter ? pose === 'phone' ? 'checking a message on their phone' : pose === 'explain' ? 'clarifying what has happened' : 'looking between you and their phone' : state.selectedChoice === 'NO_RESPONSE' ? 'stepping aside without an order' : pose === 'watch' ? 'checking her watch' : pose === 'concern' ? 'looking toward the clock' : pose === 'clarify' ? 'leaning forward attentively' : pose === 'accept' ? 'accepting the wrap' : 'waiting for your response') : undefined} aria-hidden={!showCustomer}>
        <div className={'customer-performance gesture-' + performance.gesture}>
          {poses.map(key => <img key={key} className={'customer-pose ' + (pose === key ? 'pose-active' : '')} src={publicAsset('art/' + prefix + '-' + key + '.webp')} alt="" draggable="false" />)}
        </div>
      </div>
      <img className="foreground" src={publicAsset('art/foreground.webp')} alt="" draggable="false" />
      {beat?.id === 'correction-notification' && <div className="phone-notification"><span>MESSAGE RECEIVED</span><small>A reply from their colleague</small></div>}
      {revision?.handoff?.accepted && <div className="colleague-handoff"><span>WITH YOUR COLLEAGUE</span><small>Correction pending</small></div>}
      <div className="ready-label" aria-hidden="true"><span>FRESHLY MADE</span><strong>Ready to go</strong></div>
      {!secondChapter && state.receipt && <div className="receipt" aria-label={'Printed receipt: order 48, hot chicken meal, original estimate ' + state.receipt.estimateAtEntry + ' minutes.'}><b>morrow</b><span>ORDER 048</span><i /><span>HOT CHICKEN MEAL</span><span>EST. {state.receipt.estimateAtEntry} MIN</span><small>{formatStoryTime(state.receipt.timeAtEntry)}</small><div className="receipt-barcode" /></div>}
      {state.chapter === 2 && (hasTicket || state.pauseOrder?.refund === 'complete') && <div className="receipt order-slip" aria-label={hasTicket ? 'Kitchen ticket 049. HOLD ALL THREE MEALS. Do not prepare.' : 'Refund receipt. 25.00 returned. Three original meal details retained. No kitchen ticket.'}><b>morrow</b><span>{hasTicket ? 'KITCHEN TICKET 049' : 'REFUND 049'}</span><i /><span>{hasTicket ? 'HOLD ALL 3 ITEMS' : '25.00 RETURNED'}</span><span>{hasTicket ? 'DO NOT PREPARE' : '2 CHICKEN / 1 VEG'}</span><small>{hasTicket ? 'AWAIT CONFIRMATION' : 'DETAILS RETAINED'}</small><div className="receipt-barcode" /></div>}
      {revision && ['awaiting-release', 'awaiting-payment', 'released', 'handed-over'].includes(revision.status) && <div className="receipt order-slip revision-slip" aria-label={revision.status === 'handed-over' ? 'Handoff accepted. Correction unfinished. Original transaction history retained.' : revision.status === 'awaiting-payment' ? 'New draft 050. €17.20 unpaid, unsent. Original €25 refund retained.' : revision.priorChoice === 'B' ? 'New order 050. Fresh €17.20 payment authorized and paid. Original €25 refund retained.' : 'Correction record. Vegetable meal removed. €7.80 returned. Original transaction and ticket history retained.'}><b>morrow</b><span>{revision.status === 'handed-over' ? 'HANDOFF ACCEPTED' : `ORDER ${String(revisionOrder?.number).padStart(3, '0')}`}</span><i /><span>{revision.status === 'handed-over' ? 'WORK STILL PENDING' : revision.status === 'awaiting-payment' ? '17.20 UNPAID' : 'TWO CHICKEN MEALS'}</span><span>{revision.priorChoice === 'B' ? '049 REFUND RETAINED' : revision.status === 'handed-over' ? 'ORIGINAL STATE RETAINED' : '7.80 RETURNED'}</span><small>HISTORY RETAINED</small><div className="receipt-barcode" /></div>}
      {handoff && <img className="wrap-handoff" src={publicAsset('art/wrap.webp')} alt="A paper-wrapped chicken wrap slides across the counter." />}
    </div>
    <Clock minutes={state.storyTimeMinutes} seconds={state.mode === 'timed' ? state.storyTimeSeconds : undefined} mobile />
    {state.phase !== 'title' && <Terminal state={state} />}
    <div className="scene-vignette" /><div className="film-grain" /><div className="opening-shutter" />
  </div>
}

