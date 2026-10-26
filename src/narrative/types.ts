export type ChoiceId = 'A' | 'B' | 'C'
export type ResolutionId = ChoiceId | 'NO_RESPONSE'
export type PlayMode = 'timed' | 'reflective'
export type Phase = 'title' | 'opening' | 'encounter' | 'decision' | 'consequence' | 'transition' | 'ending'
export type CustomerPose = 'watch' | 'neutral' | 'concern' | 'clarify' | 'accept' | 'phone' | 'explain'
export type OrderStatus = 'unplaced' | 'entered' | 'delayed' | 'pending' | 'ready' | 'handed-off'
export type ConsequenceId = 'proceed' | 'clarify' | 'alternative' | 'keep-open' | 'refund' | 'kitchen-hold' | 'explain-confirm' | 'correct-now' | 'handover-context' | 'unanswered-lunch' | 'unanswered-pause' | 'unanswered-correction'
export type SoundCue = 'printer' | 'order-call' | 'paper' | 'bell' | 'phone' | 'footsteps'
export type TimelineMark = 'arrival' | 'decision' | 'response' | 'kitchen-update' | 'aftermath' | 'pause-arrival' | 'pause-payment' | 'pause-request' | 'pause-pressure' | 'pause-minute' | 'pause-aftermath' | 'handover' | 'correction-arrival' | 'correction-message' | 'correction-reaction' | 'correction-confirmation' | 'correction-operation' | 'correction-handoff'
export type PlayerAction = 'enter-hot-order' | 'seek-clarification' | 'offer-wrap' | 'hand-off-wrap' | 'enter-three-meals' | 'keep-paid-open' | 'refund-order' | 'send-held-ticket' | 'explain-correction' | 'begin-correction' | 'complete-correction' | 'prepare-handoff' | 'accept-handoff'
export type WorldChange =
  | { type: 'order-called'; number: number }
  | { type: 'queue-joined' }
  | { type: 'minute-passed' }
  | { type: 'grill-delay'; minutes: number }
  | { type: 'order-collected'; number: number }
  | { type: 'shift-continues'; time: number }
  | { type: 'payment-accepted' }
  | { type: 'pause-queue-joined' }
  | { type: 'manager-expectation' }
  | { type: 'colleague-responds' }
  | { type: 'correction-time' }
  | { type: 'correction-reply' }
export interface WorldEventDefinition { id: string; at: TimelineMark; change: WorldChange }
export interface PerformanceDefinition {
  voiceId?: string
  voiceDelayMs: number
  startPose?: CustomerPose
  settleMs?: number
  gesture: 'watch' | 'speak' | 'listen' | 'explain' | 'consider' | 'reach'
  camera?: 'notice'
}

export interface PaidOrder {
  number: number
  items: { name: string; amount: number }[]
  total: number
  payment: 'unpaid' | 'paid' | 'refunded'
  release: 'unreleased' | 'sent'
  preparation: 'not-started'
  hold: 'none' | 'all-items'
  refund: 'none' | 'complete'
  activeAtRegister: boolean
  request: { text: string; doNotSend: true; sentDespiteRequest: boolean } | null
}

export interface FirstEncounterRecord {
  choiceId: ResolutionId
  consequence: ConsequenceId
  orderStatus: OrderStatus
  orderItem: NarrativeState['orderItem']
  deadline: NarrativeState['customerDeadline']
  receipt: NarrativeState['receipt']
  estimate: number
  location: 'pickup' | 'aside' | 'left'
  quotation: { id: string; payment: 'unpaid'; release: 'unsent'; item: 'hot-meal' } | null
}

export interface SecondEncounterRecord {
  choiceId: ResolutionId
  colleagueIntervened: boolean
  order: PaidOrder
  register: NarrativeState['register']
  queue: NarrativeState['queue']
}

export interface CorrectionOrder {
  number: 49 | 50
  items: { name: string; cents: number }[]
  totalCents: number
  payment: 'unpaid' | 'paid'
  release: 'unreleased' | 'held' | 'released'
  preparation: 'not-started'
  collection: 'not-collected'
}
export interface TransactionEntry {
  id: string
  type: 'payment' | 'refund' | 'draft-created' | 'ticket-created' | 'ticket-amended' | 'ticket-released' | 'customer-authorization' | 'handoff'
  order: 49 | 50
  cents?: number
  items?: number
  detail: string
}
export interface CorrectionState {
  priorChoice: ResolutionId
  request: { text: string; chickenMeals: 2; totalCents: 1720; removedCents: 780 } | null
  order: CorrectionOrder | null
  status: 'awaiting-reply' | 'requested' | 'explaining' | 'awaiting-release' | 'awaiting-payment' | 'released' | 'handoff-offered' | 'handed-over' | 'unanswered'
  authorization: { change: boolean; newPayment: boolean; release: boolean }
  ledger: TransactionEntry[]
  owner: 'you' | 'colleague'
  handoff: { originalRequest: string; priorChoice: ResolutionId; payment: PaidOrder['payment']; ticket: 'none' | 'held'; revisedRequest: string; remainingActions: string[]; accepted: boolean } | null
}

export interface DecisionState {
  key: string | null
  status: 'briefing' | 'active' | 'resolved'
  durationMs: number | null
  elapsedMs: number
  firedCueIds: string[]
  resolution: ResolutionId | null
}
export interface DecisionRecord {
  sceneId: string
  choiceId: ResolutionId
  consequence: ConsequenceId
  mode: PlayMode
  elapsedMs: number | null
  cueIds: string[]
  storyTimeMinutes: number
  storyTimeSeconds: number
}

export interface AlternativeDefinition {
  id: string
  name: string
  available: boolean
}

export interface NarrativeState {
  sceneId: string
  chapter: 1 | 2 | 3
  phase: Phase
  mode: PlayMode
  decision: DecisionState | null
  interventions: { pause: boolean; correction: boolean }
  beatIndex: number
  selectedChoice: ResolutionId | null
  customerDeadline: { time: string; meaning: 'return-to-work' } | null
  orderStatus: OrderStatus
  preparationEstimate: number
  availableAlternatives: AlternativeDefinition[]
  currentConsequence: ConsequenceId | null
  decisionHistory: DecisionRecord[]
  storyTimeMinutes: number
  storyTimeSeconds: number
  kitchen: { estimateMinutes: number; grillStatus: 'normal' | 'backed-up'; calledOrder: number | null }
  queue: { first: 'waiting' | 'left'; second: 'offstage' | 'waiting' | 'advanced'; arrivals: number; nextServed: boolean; flow: 'waiting' | 'blocked' | 'moving' }
  orderItem: 'hot-meal' | 'chicken-wrap' | null
  receipt: { number: number; estimateAtEntry: number; timeAtEntry: number } | null
  firstEncounter: FirstEncounterRecord | null
  /** Original Chapter II transaction; immutable history after the handover. */
  pauseOrder: PaidOrder | null
  secondEncounter: SecondEncounterRecord | null
  /** Current Chapter III work, with its own order, authorization and append-only ledger. */
  correction: CorrectionState | null
  register: 'free' | 'occupied'
  managerExpectsMovingLine: boolean
  colleagueHelpingQueue: boolean
  eventLog: ({ source: 'external'; id: string } | { source: 'player'; action: PlayerAction } | { source: 'customer'; fact: 'return-to-work' | 'do-not-send' | 'correction-authorized' } | { source: 'temporal'; id: string; atMs: number })[]
}

export interface BeatDefinition {
  id: string
  speaker: 'Customer' | 'You' | 'Kitchen' | 'Colleague' | 'Manager' | 'Scene'
  line: string
  pose: CustomerPose
  sound?: SoundCue
  caption: string
  cue?: 'receipt' | 'delay' | 'deadline' | 'handoff'
  mark: TimelineMark
  performance: PerformanceDefinition
  actions?: readonly PlayerAction[]
  revealsDeadline?: boolean
  revealsDoNotSend?: boolean
  operationalNote?: string
  authorizesCorrection?: boolean
  priorVariants?: Partial<Record<ResolutionId, Partial<Omit<BeatDefinition, 'priorVariants'>>>>
}

export interface ChoiceDefinition {
  id: ChoiceId
  text: string
  consequence: ConsequenceId
  action: PlayerAction
  beats: readonly BeatDefinition[]
}

export interface SceneDefinition {
  id: string
  chapter: 1 | 2 | 3
  title: string
  nextSceneId?: string
  transitions?: Partial<Record<ChoiceId, BeatDefinition>>
  location: string
  time: string
  openingDuration: number
  initialEstimate: number
  conditions: { startTimeMinutes: number; returnToWorkMinutes?: number }
  worldTimeline: readonly WorldEventDefinition[]
  alternatives: readonly AlternativeDefinition[]
  encounter: readonly BeatDefinition[]
  question: BeatDefinition
  choices: readonly ChoiceDefinition[]
}

export type NarrativeEvent =
  | { type: 'BEGIN'; mode?: PlayMode }
  | { type: 'OPENING_COMPLETE' }
  | { type: 'ADVANCE' }
  | { type: 'ACTIVATE_DECISION'; decisionKey: string }
  | { type: 'ADVANCE_TIME'; decisionKey: string; elapsedMs: number }
  | { type: 'CHOOSE'; choiceId: ChoiceId; decisionKey?: string; elapsedMs?: number }
  | { type: 'REPLAY' }
  | { type: 'EXIT' }
