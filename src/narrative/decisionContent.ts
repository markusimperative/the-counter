import type { BeatDefinition, ConsequenceId, NarrativeState, SceneDefinition } from './types'

/** Initial design values, not validated thresholds. All time is active decision time. */
export const responseWindowsMs: Readonly<Record<1 | 2 | 3, number>> = { 1: 35_000, 2: 25_000, 3: 30_000 }
export interface TemporalCue { id: string; atMs: number; beat: BeatDefinition }
const cueBeat = (id: string, speaker: BeatDefinition['speaker'], line: string, pose: BeatDefinition['pose'], voiceId?: string): BeatDefinition => ({
  id, mark: 'decision', speaker, line, pose, caption: line,
  performance: { voiceId, voiceDelayMs: 0, gesture: 'listen' },
})
const beats: Record<1 | 2 | 3, readonly [BeatDefinition, BeatDefinition]> = {
  1: [
    { ...cueBeat('lunch-watch', 'Scene', 'The customer checks their watch. The queue shifts in place.', 'watch'), sound: 'bell' },
    cueBeat('lunch-uncertainty', 'Customer', "I'm not sure how much longer I can wait here.", 'concern', 'customer-waiting'),
  ],
  2: [
    { ...cueBeat('pause-line-shifts', 'Scene', 'The line shifts in place. Someone looks toward the occupied register.', 'phone'), sound: 'footsteps' },
    cueBeat('pause-manager-update', 'Manager', 'Is this order moving, or are we still waiting?', 'phone', 'pause-manager-waiting'),
  ],
  3: [
    { ...cueBeat('correction-phone-glance', 'Scene', 'The customer glances between you and their phone. The order display is unchanged.', 'phone'), sound: 'footsteps' },
    cueBeat('correction-colleague-update', 'Colleague', 'Where are we with those two meals?', 'neutral', 'correction-colleague-waiting'),
  ],
}
export function temporalCues(chapter: 1 | 2 | 3): TemporalCue[] {
  return beats[chapter].map((beat, index) => ({ id: beat.id, atMs: Math.round(responseWindowsMs[chapter] * (index + 1) / 3), beat }))
}
export function activeTemporalCue(state: NarrativeState): BeatDefinition | undefined {
  if (state.phase !== 'decision' || state.decision?.status !== 'active') return
  return temporalCues(state.chapter).find(cue => cue.id === state.decision?.firedCueIds.at(-1))?.beat
}

const lunchTimeout: readonly BeatDefinition[] = [
  { id: 'lunch-no-answer', mark: 'response', speaker: 'Customer', line: "I can't keep standing here without an answer. I'll step aside for now.", pose: 'clarify', caption: 'The customer steps aside. No order, payment or exact deadline has been established.', performance: { voiceId: 'customer-no-response', voiceDelayMs: 450, gesture: 'consider' } },
  { id: 'lunch-unresolved', mark: 'aftermath', speaker: 'Scene', line: 'They wait to one side. No order was placed, and their exact return time was never discussed.', pose: 'clarify', caption: 'No food, no saved quotation, no exact return-to-work time learned. The situation remains unresolved.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
]
const pauseTimeout: readonly BeatDefinition[] = [
  { id: 'pause-no-answer', mark: 'response', speaker: 'Colleague', line: "Can you tell me where this order stands? I'll speak to the people waiting.", pose: 'phone', caption: 'A colleague intervenes to manage the line and asks for context. This is not an informed handoff.', performance: { voiceId: 'pause-no-response-colleague', voiceDelayMs: 450, gesture: 'listen' } },
  { id: 'pause-still-unsent', mark: 'pause-aftermath', speaker: 'Customer', line: 'Please leave it unsent while we work this out.', pose: 'phone', caption: '€25.00 paid. Three meals unreleased. Register occupied. No refund, ticket or accepted handoff.', performance: { voiceId: 'pause-no-response-customer', voiceDelayMs: 450, gesture: 'consider' } },
]
const correctionTimeout: readonly BeatDefinition[] = [
  { id: 'correction-no-answer', mark: 'response', speaker: 'Customer', line: "Could you tell me what's happening with the two meals?", pose: 'explain', caption: 'The customer asks for an answer again. No correction, payment permission or release permission has been added.', performance: { voiceId: 'correction-no-response-customer', voiceDelayMs: 450, gesture: 'speak' } },
  { id: 'correction-intervention', mark: 'aftermath', speaker: 'Colleague', line: 'I can see this still needs sorting out. What has happened so far?', pose: 'neutral', caption: 'The colleague becomes aware of the unresolved correction and asks for context. Responsibility has not transferred.', performance: { voiceId: 'correction-no-response-colleague', voiceDelayMs: 450, gesture: 'listen' } },
  { id: 'correction-unresolved', mark: 'aftermath', speaker: 'Scene', line: 'The revised request is still unanswered. The payment and ticket records stay as they were. A request for context is not an accepted handoff.', pose: 'phone', caption: 'No new charge, refund, amendment, release or ownership change. The intervention and lack of response remain recorded.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
]
const transitions: Record<1 | 2, BeatDefinition> = {
  1: { id: 'unanswered-lunch-handover', mark: 'handover', speaker: 'Scene', line: 'The first customer stands aside without an order. You turn back to the counter; their exact deadline remains unknown.', pose: 'clarify', caption: 'No order or saved quotation. The first customer has not received food.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
  2: { id: 'unanswered-pause-handover', mark: 'handover', speaker: 'Scene', line: 'The colleague has asked what is happening. The paid order is still open and unsent; no informed handoff has taken place.', pose: 'phone', caption: '€25.00 paid · three meals unreleased · register occupied · colleague intervention only.', performance: { voiceDelayMs: 0, gesture: 'consider' } },
}
export function noResponseContent(scene: SceneDefinition): { consequence: ConsequenceId; beats: readonly BeatDefinition[]; transition?: BeatDefinition } {
  if (scene.chapter === 1) return { consequence: 'unanswered-lunch', beats: [lunchTimeout[0], scene.choices[0].beats[1], lunchTimeout[1]], transition: transitions[1] }
  if (scene.chapter === 2) return { consequence: 'unanswered-pause', beats: [pauseTimeout[0], scene.choices[0].beats[1], pauseTimeout[1]], transition: transitions[2] }
  return { consequence: 'unanswered-correction', beats: correctionTimeout }
}
