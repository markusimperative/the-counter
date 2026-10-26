import type { BeatDefinition, SceneDefinition } from './types'
import { theCorrection } from './correction.ts'
import { noResponseContent, temporalCues } from './decisionContent.ts'
export { theCorrection } from './correction.ts'

// The same notice, clock change and queue collection occur on every path.
const kitchenUpdate: BeatDefinition = {
  id: 'shared-kitchen-update', mark: 'kitchen-update', speaker: 'Kitchen',
  line: "Grill's backed up. Thirteen minutes on hot orders.", pose: 'neutral',
  sound: 'bell', cue: 'delay',
  caption: 'A minute passes. Order 47 is collected. The grill estimate changes to thirteen minutes.',
  performance: { voiceId: 'kitchen-delay', voiceDelayMs: 500, gesture: 'listen', camera: 'notice' },
}

export const lunchRush = {
  chapter: 1, title: 'The Lunch Rush', nextSceneId: 'morrow-the-pause',
  transitions: {
    A: { id: 'handover-waiting', mark: 'handover', speaker: 'Scene', line: 'The customer waits near the pickup hatch. Their hot meal is still in the delayed kitchen.', pose: 'concern', caption: 'Order 048 remains confirmed. You turn back to the counter.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
    B: { id: 'handover-quotation', mark: 'handover', speaker: 'Scene', line: 'The customer steps aside to think. You save their unpaid quotation without sending an order.', pose: 'clarify', caption: 'Quotation Q-048 is saved. Back at work: 12:53 PM. No kitchen order.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
    C: { id: 'handover-collected', mark: 'handover', speaker: 'Scene', line: 'The customer leaves with the wrap. That transaction is complete. You return to the next person.', pose: 'accept', caption: 'A different lunch, collected. The shift carries on.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
  },
  id: 'morrow-lunch-rush', location: 'Morrow', time: '12:43 PM', openingDuration: 1600,
  initialEstimate: 8,
  conditions: { startTimeMinutes: 12 * 60 + 43, returnToWorkMinutes: 12 * 60 + 53 },
  alternatives: [{ id: 'chicken-wrap', name: 'Chicken wrap', available: true }],
  worldTimeline: [
    { id: 'call-47', at: 'arrival', change: { type: 'order-called', number: 47 } },
    { id: 'queue-joins', at: 'decision', change: { type: 'queue-joined' } },
    { id: 'one-minute-elapses', at: 'kitchen-update', change: { type: 'minute-passed' } },
    { id: 'grill-backs-up', at: 'kitchen-update', change: { type: 'grill-delay', minutes: 13 } },
    { id: 'collect-47', at: 'kitchen-update', change: { type: 'order-collected', number: 47 } },
  ],
  encounter: [{
    id: 'a-moment-in-the-rush', mark: 'arrival', speaker: 'Kitchen',
    line: 'Order forty-seven. Ready for collection.', pose: 'watch',
    caption: 'Kitchen hum. A distant conversation. Footsteps approach.',
    performance: { voiceId: 'kitchen-order-call', voiceDelayMs: 500, gesture: 'watch' },
  }],
  question: {
    id: 'ten-minutes', mark: 'decision', speaker: 'Customer',
    line: "Hi. I've only got about ten minutes. Is that going to be enough?", pose: 'neutral',
    caption: 'Another customer joins the queue.',
    performance: { voiceId: 'customer-opening', voiceDelayMs: 450, startPose: 'watch', settleMs: 380, gesture: 'speak' },
  },
  choices: [
    {
      id: 'A', text: 'The estimate is eight minutes. Shall I put that through?',
      consequence: 'proceed', action: 'enter-hot-order',
      beats: [
        {
          id: 'order-entered', mark: 'response', speaker: 'Customer',
          line: 'Yes, please. The hot chicken meal.', pose: 'neutral', sound: 'printer', cue: 'receipt',
          caption: 'The printer feeds a receipt. The hot meal is sent to the kitchen.',
          performance: { voiceId: 'customer-hot-meal', voiceDelayMs: 450, gesture: 'speak' },
        },
        kitchenUpdate,
        {
          id: 'expectation-shifts', mark: 'aftermath', speaker: 'Customer',
          line: "That may be too long. I might have to leave before it's ready.", pose: 'concern',
          caption: 'A glance toward the clock. The confirmed hot order remains in the kitchen.',
          performance: { voiceId: 'customer-hot-reaction', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'consider' },
        },
      ],
    },
    {
      id: 'B', text: 'You mentioned ten minutes. Is that when you need to leave?',
      consequence: 'clarify', action: 'seek-clarification',
      beats: [
        {
          id: 'a-precise-deadline', mark: 'response', speaker: 'Customer',
          line: "I need to be back at work at 12:53. That's when my break ends.", pose: 'clarify',
          cue: 'deadline', revealsDeadline: true,
          caption: 'They lean closer. Back at work: 12:53 PM. The order remains pending.',
          performance: { voiceId: 'customer-deadline', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'explain' },
        },
        kitchenUpdate,
        {
          id: 'deadline-unresolved', mark: 'aftermath', speaker: 'Customer',
          line: "That's longer than my break. Let me think for a moment.", pose: 'clarify',
          caption: 'The return-to-work time stays on the terminal. No order has been sent.',
          performance: { voiceId: 'customer-pending-reaction', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'consider' },
        },
      ],
    },
    {
      id: 'C', text: "There's a wrap ready now, if you'd prefer that instead.",
      consequence: 'alternative', action: 'offer-wrap',
      beats: [
        {
          id: 'a-different-lunch', mark: 'response', speaker: 'Customer',
          line: 'A wrap, then. Not what I had in mind, but I’ll take it.', pose: 'accept',
          caption: 'Their gaze settles on the ready case. A chicken wrap is selected.',
          performance: { voiceId: 'customer-wrap', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'consider' },
        },
        kitchenUpdate,
        {
          id: 'ready-now', mark: 'aftermath', speaker: 'Customer',
          line: "I'll take it with me. A napkin as well, please.", pose: 'accept',
          sound: 'paper', cue: 'handoff', actions: ['hand-off-wrap'],
          caption: 'Paper rustles across the counter. The wrap is handed over; the grill is still delayed.',
          performance: { voiceId: 'customer-wrap-handoff', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'reach' },
        },
      ],
    },
  ],
} satisfies SceneDefinition

const registerLimits = 'An open paid order occupies this register. A refund frees it, but the customer must start again. Sending a HOLD ticket keeps its kitchen place, but sends the order; preparation waits.'
const pausePickup: BeatDefinition = {
  id: 'pause-shared-pickup', mark: 'pause-minute', speaker: 'Kitchen',
  line: 'Order forty-six. Ready for collection.', pose: 'phone', sound: 'bell',
  caption: 'A minute passes. Another person joins the queue. The grill estimate remains thirteen minutes.',
  performance: { voiceId: 'pause-pickup', voiceDelayMs: 500, gesture: 'listen', camera: 'notice' },
}

export const thePause = {
  id: 'morrow-the-pause', chapter: 2, title: 'The Pause', location: 'Morrow', time: '12:46 PM',
  nextSceneId: 'morrow-the-correction',
  transitions: {
    A: { id: 'pause-to-correction-open', mark: 'handover', speaker: 'Scene', line: 'The paid order remains open. Your colleague speaks to the queue while the customer waits for a reply.', pose: 'phone', caption: 'Order 049 · €25.00 paid · unreleased · register occupied.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
    B: { id: 'pause-to-correction-refund', mark: 'handover', speaker: 'Scene', line: 'The refund stays complete. The customer waits with the original details saved and no active order.', pose: 'phone', caption: 'Order 049 · €25.00 refunded · no kitchen ticket · register available.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
    C: { id: 'pause-to-correction-hold', mark: 'handover', speaker: 'Scene', line: 'Ticket 049 stays on HOLD. The kitchen has not started; the customer is still waiting for a reply.', pose: 'phone', caption: 'Three-meal ticket sent despite the request · €25.00 paid · no preparation.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
  },
  openingDuration: 1100, initialEstimate: 13,
  conditions: { startTimeMinutes: 766 },
  alternatives: [],
  worldTimeline: [
    { id: 'pause-shift-continues', at: 'pause-arrival', change: { type: 'shift-continues', time: 766 } },
    { id: 'pause-payment-accepted', at: 'pause-payment', change: { type: 'payment-accepted' } },
    { id: 'pause-manager-expectation', at: 'pause-pressure', change: { type: 'manager-expectation' } },
    { id: 'pause-minute-elapses', at: 'pause-minute', change: { type: 'minute-passed' } },
    { id: 'pause-another-arrival', at: 'pause-minute', change: { type: 'pause-queue-joined' } },
    { id: 'pause-call-46', at: 'pause-minute', change: { type: 'order-called', number: 46 } },
    { id: 'pause-colleague-responds', at: 'pause-aftermath', change: { type: 'colleague-responds' } },
  ],
  encounter: [
    {
      id: 'pause-paid-order', mark: 'pause-payment', speaker: 'Scene',
      line: 'Three meals entered. Payment accepted. The order is still on this register; nothing has reached the kitchen.',
      pose: 'neutral', actions: ['enter-three-meals'],
      caption: 'Order 049 · two hot chicken meals, one vegetable meal · paid 25.00 · not sent.',
      performance: { voiceDelayMs: 0, gesture: 'speak' },
    },
    {
      id: 'pause-customer-request', mark: 'pause-request', speaker: 'Customer',
      line: "Sorry, could you wait? My colleague might want to change the third meal. Please don't send it to the kitchen yet.",
      pose: 'phone', revealsDoNotSend: true,
      caption: 'They glance down at a message. The third meal is still unconfirmed.',
      performance: { voiceId: 'pause-customer-request', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'consider' },
    },
    {
      id: 'pause-colleague-pressure', mark: 'pause-pressure', speaker: 'Colleague',
      line: "I've got more people waiting. That order's still tying up this till.", pose: 'phone',
      caption: 'A colleague looks along the queue. This is the active register.',
      performance: { voiceId: 'pause-colleague-pressure', voiceDelayMs: 450, gesture: 'listen' },
    },
    {
      id: 'pause-manager-pressure', mark: 'pause-pressure', speaker: 'Manager',
      line: "Can we keep the line moving, please? There's a queue to the door.", pose: 'neutral',
      caption: 'The manager calls from farther down the counter. The kitchen is still delayed.',
      operationalNote: registerLimits,
      performance: { voiceId: 'pause-manager-pressure', voiceDelayMs: 450, startPose: 'phone', settleMs: 350, gesture: 'listen' },
    },
  ],
  question: {
    id: 'pause-decision', mark: 'pause-request', speaker: 'Customer',
    line: "I'm still waiting for a reply. Please leave it unsent.", pose: 'neutral',
    caption: 'Their phone stays in hand. The paid order remains unreleased.',
    operationalNote: 'Open: register occupied. Refund: restart required. HOLD: ticket sent, no preparation.',
    performance: { voiceId: 'pause-customer-decision', voiceDelayMs: 450, startPose: 'phone', settleMs: 350, gesture: 'speak' },
  },
  choices: [
    {
      id: 'A', text: "I'll keep the paid order open while you check. This register will stay occupied.",
      action: 'keep-paid-open', consequence: 'keep-open',
      beats: [
        {
          id: 'pause-kept-open', mark: 'response', speaker: 'Customer',
          line: "They're checking now. I'll keep the third meal as it is until they reply.", pose: 'phone',
          caption: 'Payment retained. Order 049 stays on the register, unreleased.',
          performance: { voiceId: 'pause-customer-keep', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'consider' },
        },
        pausePickup,
        {
          id: 'pause-open-aftermath', mark: 'pause-aftermath', speaker: 'Colleague',
          line: "I'll speak to the people waiting. Your register's still tied up.", pose: 'phone',
          caption: 'The colleague attends to the growing queue. The customer keeps checking; the paid order is not sent.',
          performance: { voiceId: 'pause-colleague-open', voiceDelayMs: 450, gesture: 'listen' },
        },
      ],
    },
    {
      id: 'B', text: "I'll refund it and free the register. We can start a new order when you're ready.",
      action: 'refund-order', consequence: 'refund',
      beats: [
        {
          id: 'pause-refunded', mark: 'response', speaker: 'Customer',
          line: "All right. I'll have to go through the three meals again when they're ready.", pose: 'explain', sound: 'printer',
          caption: 'Refund completed: 25.00. The original details are retained in history, without a kitchen order.',
          performance: { voiceId: 'pause-customer-refund', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'explain' },
        },
        pausePickup,
        {
          id: 'pause-refund-aftermath', mark: 'pause-aftermath', speaker: 'Colleague',
          line: "The refund's complete. I'll take the next person while they check.", pose: 'neutral',
          caption: 'The register is available. The next customer advances; a new order will be needed.',
          performance: { voiceId: 'pause-colleague-refund', voiceDelayMs: 450, startPose: 'phone', settleMs: 350, gesture: 'listen' },
        },
      ],
    },
    {
      id: 'C', text: "I'll send a HOLD ticket to keep its place. The kitchen will wait to prepare it.",
      action: 'send-held-ticket', consequence: 'kitchen-hold',
      beats: [
        {
          id: 'pause-ticket-sent', mark: 'response', speaker: 'Customer',
          line: "I asked you not to send it. Is the kitchen already making it?", pose: 'explain', sound: 'printer',
          caption: 'Ticket 049 sent despite the request. HOLD ALL ITEMS: do not prepare. The register is available.',
          performance: { voiceId: 'pause-customer-ticket', voiceDelayMs: 450, startPose: 'neutral', settleMs: 350, gesture: 'explain' },
        },
        pausePickup,
        {
          id: 'pause-hold-aftermath', mark: 'pause-aftermath', speaker: 'Colleague',
          line: "All three meals are on hold. The ticket exists, but preparation hasn't started.", pose: 'explain',
          caption: 'The kitchen holds all three meals, including the third. The earlier request remains recorded. The next customer advances.',
          performance: { voiceId: 'pause-colleague-hold', voiceDelayMs: 450, startPose: 'phone', settleMs: 350, gesture: 'listen' },
        },
      ],
    },
  ],
} satisfies SceneDefinition

export const scenes: readonly SceneDefinition[] = [lunchRush, thePause, theCorrection]
export function sceneForId(id: string): SceneDefinition { return scenes.find(scene => scene.id === id) ?? lunchRush }

/** All authored voice variants, including inherited realities, for offline authoring/verification. */
export function authoredBeats(scene: SceneDefinition): BeatDefinition[] {
  return [scene.question, ...scene.encounter, ...scene.choices.flatMap(choice => choice.beats), ...noResponseContent(scene).beats, ...temporalCues(scene.chapter).map(cue => cue.beat)].flatMap(beat => [
    beat, ...Object.values(beat.priorVariants ?? {}).map(variant => ({ ...beat, ...variant, priorVariants: undefined })),
  ])
}
