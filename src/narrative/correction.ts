import type { BeatDefinition, SceneDefinition } from './types'

export const revisedRequest = "I've heard back. We only need the two chicken meals now. Could you remove the third one?"

const voice = (voiceId: string, gesture: BeatDefinition['performance']['gesture'] = 'speak') => ({ voiceId, voiceDelayMs: 450, gesture })
const variant = (line: string, voiceId: string, extra: Partial<Omit<BeatDefinition, 'priorVariants'>> = {}) => ({ line, performance: voice(voiceId), ...extra })

// One chapter, with factual variations selected from the preserved second encounter.
export const theCorrection = {
  id: 'morrow-the-correction', chapter: 3, title: 'The Correction', location: 'Morrow', time: '12:49 PM',
  openingDuration: 900, initialEstimate: 13, conditions: { startTimeMinutes: 769 }, alternatives: [],
  worldTimeline: [
    { id: 'correction-two-minutes', at: 'correction-arrival', change: { type: 'correction-time' } },
    { id: 'correction-colleague-reply', at: 'correction-message', change: { type: 'correction-reply' } },
  ],
  encounter: [
    {
      id: 'correction-notification', mark: 'correction-arrival', speaker: 'Scene',
      line: 'Two minutes later. Their phone vibrates. A reply has arrived.', pose: 'phone', sound: 'phone',
      caption: '12:49 PM. A short phone vibration. The grill is still delayed; the queue remains.',
      performance: { voiceDelayMs: 0, gesture: 'consider', camera: 'notice' },
    },
    {
      id: 'correction-new-information', mark: 'correction-message', speaker: 'Customer',
      line: revisedRequest, pose: 'phone', caption: 'The message changes the request: two chicken meals, €17.20. Remove the €7.80 vegetable meal.',
      performance: voice('correction-customer-request'),
    },
    {
      id: 'correction-inherited-state', mark: 'correction-reaction', speaker: 'Customer',
      line: "You've kept it open all this time?", pose: 'explain',
      caption: 'They look toward the waiting line. €25.00 remains paid; order 049 is still on this register, with no ticket.',
      operationalNote: 'Review the original transaction, new request and remaining authorization.',
      performance: voice('correction-opening-open', 'consider'),
      priorVariants: {
        NO_RESPONSE: variant("I still haven't had an answer about the order. Can we change it now?", 'correction-opening-unanswered', { caption: 'The earlier pause expired without a response. €25.00 is still paid, three meals are unsent, and the register is occupied. The colleague only intervened.' }),
        B: variant("Oh, you've refunded it? I thought we were waiting.", 'correction-opening-refund', { caption: 'A refund notification is on their phone. €25.00 was returned. No active order or kitchen ticket exists.' }),
        C: variant('You sent something through? I asked you to wait.', 'correction-opening-hold', { caption: 'Ticket 049 still holds three meals. €25.00 is paid; preparation has not started. The earlier request remains recorded.' }),
      },
    },
  ],
  question: {
    id: 'correction-decision', mark: 'correction-reaction', speaker: 'Customer',
    line: 'Where are we with the order?', pose: 'neutral',
    caption: 'The revised request waits. The original payment and ticket records remain.',
    performance: { ...voice('correction-customer-where'), startPose: 'phone', settleMs: 350 },
  },
  choices: [
    {
      id: 'A', text: "Let me explain exactly where the order stands. Then we'll confirm the change before I do anything else.",
      action: 'explain-correction', consequence: 'explain-confirm',
      beats: [
        {
          id: 'correction-explanation', mark: 'response', speaker: 'You',
          line: "I kept all three meals open, as you asked. Your twenty-five euros is still paid. Nothing has gone to the kitchen, and this register has stayed occupied. We can remove the vegetable meal, return seven eighty, and send the two chicken meals if you confirm.",
          pose: 'neutral', caption: 'You explain the occupied register and unreleased order. No correction has been made yet.',
          performance: voice('correction-explain-open', 'listen'),
          priorVariants: {
            NO_RESPONSE: variant("I didn't resolve it while you waited. Your twenty-five euros is still paid, and all three meals are unsent. The register remains occupied. My colleague has only asked for context, not taken over. If you confirm, I can remove the vegetable meal, return seven eighty, and send the two chicken meals.", 'correction-explain-unanswered', { caption: 'You explain the unanswered pause and intervention accurately. No correction or informed handoff has occurred.' }),
            B: variant("I refunded the twenty-five euros to free the register. There is no active order or kitchen ticket. For two chicken meals, we need a new order and a fresh payment of seventeen twenty. May I take that payment and send the new order?", 'correction-explain-refund', { caption: 'The original refund remains complete. No new payment is assumed.' }),
            C: variant("I sent ticket forty-nine on hold, even though you asked me not to send it. All three meals are on it, but preparation hasn't started. Your twenty-five euros is still paid. With your confirmation, I can amend that ticket, return seven eighty, and release the two meals.", 'correction-explain-hold', { caption: 'You name the earlier action. Ticket history remains; no amendment or release has happened yet.' }),
          },
        },
        {
          id: 'correction-deliberate-confirmation', mark: 'correction-confirmation', speaker: 'Customer',
          line: 'Yes. Remove the vegetable meal, return the seven eighty, and send the two chicken meals.',
          pose: 'explain', authorizesCorrection: true,
          caption: 'The customer explicitly confirms the change, adjustment and release.',
          performance: voice('correction-confirm-open'),
          priorVariants: {
            B: variant('Yes. Start the new order. I authorize a new payment of seventeen twenty, and you can send the two chicken meals.', 'correction-confirm-refund', { caption: 'Fresh payment and release are explicitly authorized. The prior refund is not reversed.' }),
            C: variant('Yes. Amend that ticket to two chicken meals, return the seven eighty, and release the hold.', 'correction-confirm-hold'),
          },
        },
        {
          id: 'correction-confirmed-operation', mark: 'correction-operation', speaker: 'Colleague',
          line: "The seven eighty is returned. Order forty-nine is now two chicken meals, released to the kitchen. Preparation hasn't started.",
          pose: 'neutral', actions: ['complete-correction'], sound: 'printer',
          caption: '€7.80 adjustment recorded. Corrected order released after confirmation; no meals are prepared or collected.',
          performance: voice('correction-complete-open', 'listen'),
          priorVariants: {
            B: variant("New order fifty: seventeen twenty paid with your authorization, then sent. The earlier twenty-five-euro refund stays on record. Preparation hasn't started.", 'correction-complete-refund', { caption: 'Order 050 is paid and released. Refunded order 049 stays in history. Nothing is prepared or collected.' }),
            C: variant("Ticket forty-nine is amended to two chicken meals and released. Seven eighty is returned. The original hold remains in its history. Preparation hasn't started.", 'correction-complete-hold', { caption: 'The same ticket has an amendment and a release record. No duplicate ticket or preparation.' }),
          },
        },
      ],
    },
    {
      id: 'B', text: "I'll update it for two meals now. I'll let you know what I need from you.",
      action: 'begin-correction', consequence: 'correct-now',
      beats: [
        {
          id: 'correction-started', mark: 'response', speaker: 'You',
          line: "I've removed the vegetable meal and returned seven eighty. Shall I send the two chicken meals now?",
          pose: 'neutral', sound: 'printer',
          caption: 'Two meals remain. The €7.80 adjustment is complete; order 049 is still unreleased pending permission.',
          performance: voice('correction-now-open', 'listen'),
          priorVariants: {
            B: variant("A new order for two chicken meals comes to seventeen twenty. The earlier twenty-five euros has been refunded. I'll need a fresh payment before I send it.", 'correction-now-refund', { caption: 'Draft 050 is entered for €17.20, unpaid and unsent. No payment has been authorized or charged.' }),
            C: variant("I've amended ticket forty-nine to two chicken meals and returned seven eighty. It's still on hold. May I release it?", 'correction-now-hold', { caption: 'Ticket 049 now has an explicit amendment. €7.80 returned. HOLD stays until release is authorized.' }),
          },
        },
        {
          id: 'correction-operational-confirmation', mark: 'correction-confirmation', speaker: 'Customer',
          line: 'Yes, send the two chicken meals.', pose: 'explain', authorizesCorrection: true,
          caption: 'The customer authorizes release after the change.', performance: voice('correction-now-confirm-open'),
          priorVariants: {
            B: variant('Let me get my card. That refund is still showing on my phone.', 'correction-now-card', { authorizesCorrection: false, caption: 'Getting a card is not payment authorization. Draft 050 stays unpaid and unsent.' }),
            C: variant('Yes. You can release the two chicken meals now.', 'correction-now-confirm-hold'),
          },
        },
        {
          id: 'correction-operational-result', mark: 'correction-operation', speaker: 'Colleague',
          line: "Order forty-nine is released for two chicken meals. The adjustment is recorded. Preparation hasn't started.",
          pose: 'neutral', actions: ['complete-correction'],
          caption: 'The corrected paid order is released after permission. The queue moves; the kitchen remains delayed.',
          performance: voice('correction-now-result-open', 'listen'),
          priorVariants: {
            B: variant("The new order is entered. Payment is pending; nothing has gone to the kitchen. I'll keep the line moving while you get your card.", 'correction-now-result-refund', { caption: 'Draft 050 · €17.20 · awaiting fresh authorization. Order 049 remains refunded. Correction is not complete.' }),
            C: variant("The amended ticket is released. Its original three-meal hold is still on record. Preparation hasn't started.", 'correction-now-result-hold', { caption: 'Ticket 049 retains its original send, amendment and authorized release. No new ticket or preparation.' }),
          },
        },
      ],
    },
    {
      id: 'C', text: "I'll bring my colleague into this with the full details, so you don't have to explain everything again.",
      action: 'prepare-handoff', consequence: 'handover-context',
      beats: [
        {
          id: 'correction-full-handoff', mark: 'response', speaker: 'You',
          line: "They asked us to leave three meals unsent. I kept the paid order open: twenty-five euros, no kitchen ticket, register occupied. Now they only need two chicken meals. Please confirm the change, return seven eighty, and get permission to send it.",
          pose: 'neutral', caption: 'You give your colleague the original request, action, payment, ticket state, new request and remaining work.',
          performance: voice('correction-handoff-open', 'listen'),
          priorVariants: {
            NO_RESPONSE: variant("They asked us to leave three meals unsent. I didn't resolve the situation; you intervened to ask what was happening. Twenty-five euros is still paid, no ticket exists, and the register is occupied. They now need two chicken meals. Please confirm the change, return seven eighty, and get permission to send it.", 'correction-handoff-unanswered'),
            B: variant("They asked us to leave three meals unsent. I refunded the twenty-five euros to free the register. There is no active order or kitchen ticket. Now they need two chicken meals. Please confirm a new order, fresh payment of seventeen twenty, and permission to send it.", 'correction-handoff-refund'),
            C: variant("They asked us not to send three meals. I sent ticket forty-nine on hold despite that request. Twenty-five euros is paid; preparation hasn't started. Now they need two chicken meals. Please confirm the amendment, return seven eighty, and get permission to release the ticket.", 'correction-handoff-hold'),
          },
        },
        {
          id: 'correction-colleague-accepts', mark: 'correction-handoff', speaker: 'Colleague',
          line: "I've got the paid, unsent order and the new request. I'll take responsibility here and confirm the adjustment and release with you before I continue.",
          pose: 'explain', actions: ['accept-handoff'],
          caption: 'The colleague accepts the work. This register is released for the queue; the order itself remains uncorrected.',
          performance: voice('correction-accept-open', 'listen'),
          priorVariants: {
            B: variant("I've got the refunded order details and the new request. I'll confirm a fresh order and payment with you. Nothing will be charged or sent before that.", 'correction-accept-refund', { caption: 'The colleague accepts the complete history. No active order, new payment or ticket yet.' }),
            C: variant("I've got ticket forty-nine on hold and the new request. I'll confirm the amendment, refund and release with you. The hold stays until then.", 'correction-accept-hold', { caption: 'The colleague accepts the held ticket and its history. Three meals remain on HOLD; the amendment is still pending.' }),
          },
        },
        {
          id: 'correction-handoff-aftermath', mark: 'aftermath', speaker: 'Scene',
          line: 'Your colleague stays with the customer. You turn to the waiting line. The correction is still theirs to finish.',
          pose: 'phone', caption: 'Responsibility transferred, work unfinished. The original transaction and revised request stay together.',
          performance: { voiceDelayMs: 0, gesture: 'consider' },
        },
      ],
    },
  ],
} satisfies SceneDefinition
