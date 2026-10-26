import { lunchRush, sceneForId } from './story'
import type { BeatDefinition, DecisionRecord, FirstEncounterRecord, NarrativeEvent, NarrativeState, PlayerAction, PlayMode, ResolutionId, SceneDefinition, TimelineMark } from './types'
import { applyCorrectionAction, authorizeCorrection, initializeCorrection, receiveCorrectionReply } from './revision'
import { noResponseContent, responseWindowsMs, temporalCues } from './decisionContent'

export function formatStoryTime(minutes: number, seconds?: number): string {
  const hours = Math.floor(minutes / 60) % 24
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, '0')}${seconds === undefined ? '' : ':' + String(seconds).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

export function createInitialState(scene: SceneDefinition = lunchRush, mode: PlayMode = 'reflective'): NarrativeState {
  return {
    sceneId: scene.id, chapter: scene.chapter, phase: 'title', beatIndex: 0, selectedChoice: null,
    mode, decision: null, interventions: { pause: false, correction: false }, storyTimeSeconds: 0,
    customerDeadline: null, orderStatus: 'unplaced', preparationEstimate: scene.initialEstimate,
    availableAlternatives: scene.alternatives.map(alternative => ({ ...alternative })),
    currentConsequence: null, decisionHistory: [], storyTimeMinutes: scene.conditions.startTimeMinutes,
    kitchen: { estimateMinutes: scene.initialEstimate, grillStatus: scene.chapter === 2 ? 'backed-up' : 'normal', calledOrder: null },
    queue: { first: 'waiting', second: 'offstage', arrivals: 0, nextServed: false, flow: 'waiting' },
    orderItem: null, receipt: null, firstEncounter: null, pauseOrder: null, secondEncounter: null, correction: null,
    register: 'free', managerExpectsMovingLine: false, colleagueHelpingQueue: false, eventLog: [],
  }
}

export function currentBeat(state: NarrativeState, scene: SceneDefinition = sceneForId(state.sceneId)): BeatDefinition | undefined {
  const unanswered = state.selectedChoice === 'NO_RESPONSE' ? noResponseContent(scene) : undefined
  const beat = state.phase === 'encounter' ? scene.encounter[state.beatIndex]
    : state.phase === 'decision' ? scene.question
      : state.phase === 'transition' && state.selectedChoice ? unanswered?.transition ?? scene.transitions?.[state.selectedChoice as 'A' | 'B' | 'C']
        : state.phase === 'consequence' ? unanswered?.beats[state.beatIndex] ?? scene.choices.find(choice => choice.id === state.selectedChoice)?.beats[state.beatIndex] : undefined
  const variant = state.chapter === 3 && state.secondEncounter && beat?.priorVariants?.[state.secondEncounter.choiceId]
  return beat && variant ? { ...beat, ...variant } : beat
}

function worldAt(state: NarrativeState, mark: TimelineMark, scene: SceneDefinition): NarrativeState {
  return scene.worldTimeline.filter(event => event.at === mark).reduce((next, event) => {
    if (next.eventLog.some(entry => entry.source === 'external' && entry.id === event.id)) return next
    const change = event.change
    next = { ...next, eventLog: [...next.eventLog, { source: 'external', id: event.id }] }
    switch (change.type) {
      case 'order-called': return { ...next, kitchen: { ...next.kitchen, calledOrder: change.number } }
      case 'queue-joined': return { ...next, queue: { ...next.queue, second: 'waiting' } }
      case 'minute-passed': return { ...next, storyTimeMinutes: next.storyTimeMinutes + 1, storyTimeSeconds: 0 }
      case 'grill-delay': return {
        ...next, kitchen: { ...next.kitchen, estimateMinutes: change.minutes, grillStatus: 'backed-up' },
        preparationEstimate: next.orderItem === 'chicken-wrap' ? 0 : change.minutes,
        orderStatus: next.orderStatus === 'entered' ? 'delayed' : next.orderStatus,
      }
      case 'order-collected': return {
        ...next, kitchen: { ...next.kitchen, calledOrder: next.kitchen.calledOrder === change.number ? null : next.kitchen.calledOrder },
        queue: { ...next.queue, first: 'left', second: next.queue.second === 'offstage' ? 'offstage' : 'advanced' },
      }
      case 'shift-continues': return { ...next, storyTimeMinutes: change.time, storyTimeSeconds: 0, queue: { ...next.queue, flow: 'waiting' } }
      case 'payment-accepted': return next.pauseOrder ? { ...next, pauseOrder: { ...next.pauseOrder, payment: 'paid' } } : next
      case 'pause-queue-joined': return { ...next, queue: { ...next.queue, arrivals: next.queue.arrivals + 1 } }
      case 'manager-expectation': return { ...next, managerExpectsMovingLine: true }
      case 'colleague-responds': return {
        ...next, colleagueHelpingQueue: next.register === 'occupied',
        queue: { ...next.queue, flow: next.register === 'occupied' ? 'blocked' : 'moving', nextServed: next.register === 'free' },
      }
      case 'correction-time': return { ...next, storyTimeMinutes: 769, storyTimeSeconds: 0 }
      case 'correction-reply': return receiveCorrectionReply(next)
    }
  }, state)
}

function act(state: NarrativeState, action: PlayerAction): NarrativeState {
  const next: NarrativeState = { ...state, eventLog: [...state.eventLog, { source: 'player', action }] }
  switch (action) {
    case 'enter-hot-order': return { ...next, orderStatus: 'entered', orderItem: 'hot-meal', receipt: { number: 48, estimateAtEntry: state.kitchen.estimateMinutes, timeAtEntry: state.storyTimeMinutes } }
    case 'seek-clarification': return { ...next, orderStatus: 'pending', orderItem: 'hot-meal' }
    case 'offer-wrap': return { ...next, orderStatus: 'ready', orderItem: 'chicken-wrap', preparationEstimate: 0 }
    case 'hand-off-wrap': return state.orderStatus === 'ready' ? { ...next, orderStatus: 'handed-off' } : state
    case 'enter-three-meals': return {
      ...next, register: 'occupied', pauseOrder: {
        number: 49, items: [{ name: 'Hot chicken meal', amount: 8.6 }, { name: 'Hot chicken meal', amount: 8.6 }, { name: 'Vegetable meal', amount: 7.8 }],
        total: 25, payment: 'unpaid', release: 'unreleased', preparation: 'not-started', hold: 'none', refund: 'none', activeAtRegister: true, request: null,
      },
    }
    case 'keep-paid-open': return state.pauseOrder?.payment === 'paid' ? { ...next, register: 'occupied', queue: { ...state.queue, flow: 'blocked' } } : state
    case 'refund-order': return state.pauseOrder?.payment === 'paid' ? {
      ...next, register: 'free', pauseOrder: { ...state.pauseOrder, payment: 'refunded', refund: 'complete', activeAtRegister: false },
    } : state
    case 'send-held-ticket': return state.pauseOrder?.payment === 'paid' ? {
      ...next, register: 'free', pauseOrder: {
        ...state.pauseOrder, release: 'sent', hold: 'all-items', activeAtRegister: false,
        request: state.pauseOrder.request ? { ...state.pauseOrder.request, sentDespiteRequest: true } : null,
      },
    } : state
    case 'explain-correction': case 'begin-correction': case 'complete-correction': case 'prepare-handoff': case 'accept-handoff':
      return applyCorrectionAction(state, action)
  }
}

function enterBeat(state: NarrativeState, scene: SceneDefinition): NarrativeState {
  const beat = currentBeat(state, scene)
  if (!beat) return state
  let next = state
  for (const action of beat.actions ?? []) next = act(next, action)
  next = worldAt(next, beat.mark, scene)
  if (beat.authorizesCorrection) next = authorizeCorrection(next, beat.line)
  if (beat.revealsDeadline && scene.conditions.returnToWorkMinutes !== undefined && !next.customerDeadline) next = {
    ...next,
    customerDeadline: { time: formatStoryTime(scene.conditions.returnToWorkMinutes).replace(' PM', '').replace(' AM', ''), meaning: 'return-to-work' },
    eventLog: [...next.eventLog, { source: 'customer', fact: 'return-to-work' }],
  }
  if (beat.revealsDoNotSend && next.pauseOrder && !next.pauseOrder.request) next = {
    ...next, pauseOrder: { ...next.pauseOrder, request: { text: beat.line, doNotSend: true, sentDespiteRequest: false } },
    eventLog: [...next.eventLog, { source: 'customer', fact: 'do-not-send' }],
  }
  return next
}

function rememberFirst(state: NarrativeState): FirstEncounterRecord {
  const choiceId = state.selectedChoice!
  return {
    choiceId, consequence: state.currentConsequence!, orderStatus: state.orderStatus, orderItem: state.orderItem,
    deadline: state.customerDeadline ? { ...state.customerDeadline } : null,
    receipt: state.receipt ? { ...state.receipt } : null, estimate: state.preparationEstimate,
    location: choiceId === 'A' ? 'pickup' : choiceId === 'C' ? 'left' : 'aside',
    quotation: choiceId === 'B' ? { id: 'Q-048', payment: 'unpaid', release: 'unsent', item: 'hot-meal' } : null,
  }
}

function decisionRecord(state: NarrativeState, choiceId: ResolutionId, consequence: DecisionRecord['consequence']): DecisionRecord {
  return { sceneId: state.sceneId, choiceId, consequence, mode: state.mode, elapsedMs: state.mode === 'timed' ? state.decision!.elapsedMs : null,
    cueIds: [...state.decision!.firedCueIds], storyTimeMinutes: state.storyTimeMinutes, storyTimeSeconds: state.storyTimeSeconds }
}

function expireDecision(state: NarrativeState, scene: SceneDefinition): NarrativeState {
  let next: NarrativeState = { ...state, phase: 'consequence', beatIndex: 0, selectedChoice: 'NO_RESPONSE', currentConsequence: noResponseContent(scene).consequence,
    decision: { ...state.decision!, status: 'resolved', resolution: 'NO_RESPONSE' }, decisionHistory: [...state.decisionHistory, decisionRecord(state, 'NO_RESPONSE', noResponseContent(scene).consequence)] }
  if (state.chapter === 2) next = { ...next, interventions: { ...next.interventions, pause: true }, colleagueHelpingQueue: true, register: 'occupied', queue: { ...next.queue, flow: 'blocked', nextServed: false } }
  if (state.chapter === 3) next = { ...next, interventions: { ...next.interventions, correction: true }, correction: next.correction ? { ...next.correction, status: 'unanswered' } : null }
  return enterBeat(next, scene)
}

/** Absolute active milliseconds make delayed callbacks and gesture/deadline races explicit. */
function observeTime(state: NarrativeState, elapsedMs: number, scene: SceneDefinition): NarrativeState {
  const decision = state.decision
  if (state.phase !== 'decision' || state.mode !== 'timed' || decision?.status !== 'active' || !Number.isFinite(elapsedMs) || elapsedMs < 0) return state
  const elapsed = Math.min(decision.durationMs!, Math.max(decision.elapsedMs, elapsedMs))
  if (elapsed === decision.elapsedMs) return state
  const cues = temporalCues(state.chapter).filter(cue => cue.atMs <= elapsed && !decision.firedCueIds.includes(cue.id))
  const next: NarrativeState = { ...state, storyTimeSeconds: Math.floor(elapsed / 1000), decision: { ...decision, elapsedMs: elapsed, firedCueIds: [...decision.firedCueIds, ...cues.map(cue => cue.id)] },
    eventLog: [...state.eventLog, ...cues.map(cue => ({ source: 'temporal' as const, id: cue.id, atMs: cue.atMs }))] }
  return elapsed >= decision.durationMs! ? expireDecision(next, scene) : next
}

/** Player controls and explicit active-time observations are the only narrative inputs. */
export function narrativeReducer(state: NarrativeState, event: NarrativeEvent, scene: SceneDefinition = sceneForId(state.sceneId)): NarrativeState {
  const initialScene = scene.chapter === 1 ? scene : lunchRush
  switch (event.type) {
    case 'BEGIN': return state.phase === 'title' ? { ...createInitialState(initialScene, event.mode ?? state.mode), phase: 'opening' } : state
    case 'OPENING_COMPLETE': return state.phase === 'opening' ? enterBeat({ ...state, phase: 'encounter', beatIndex: 0 }, scene) : state
    case 'ACTIVATE_DECISION': return state.phase === 'decision' && state.decision?.status === 'briefing' && event.decisionKey
      ? { ...state, decision: { ...state.decision, key: event.decisionKey, status: 'active' } } : state
    case 'ADVANCE_TIME': return state.decision?.key === event.decisionKey ? observeTime(state, event.elapsedMs, scene) : state
    case 'CHOOSE': {
      if (state.phase !== 'decision' || state.decision?.status !== 'active' || (event.decisionKey !== undefined && event.decisionKey !== state.decision.key)) return state
      if (state.mode === 'timed' && (event.elapsedMs === undefined || event.decisionKey === undefined || !Number.isFinite(event.elapsedMs) || event.elapsedMs < 0)) return state
      const observed = state.mode === 'timed' ? observeTime(state, event.elapsedMs!, scene) : state
      if (observed.phase !== 'decision') return observed
      const choice = scene.choices.find(candidate => candidate.id === event.choiceId)
      if (!choice) return state
      return enterBeat(act({
        ...observed, phase: 'consequence', beatIndex: 0, selectedChoice: choice.id, currentConsequence: choice.consequence,
        decision: { ...observed.decision!, status: 'resolved', resolution: choice.id },
        decisionHistory: [...observed.decisionHistory, decisionRecord(observed, choice.id, choice.consequence)],
      }, choice.action), scene)
    }
    case 'ADVANCE': {
      if (state.phase === 'transition' && scene.nextSceneId) {
        const nextScene = sceneForId(scene.nextSceneId)
        return worldAt({ ...state, sceneId: nextScene.id, chapter: nextScene.chapter, phase: 'opening', beatIndex: 0, selectedChoice: null, currentConsequence: null,
          decision: null, correction: nextScene.chapter === 3 && state.secondEncounter ? initializeCorrection(state.secondEncounter) : state.correction,
        }, nextScene.chapter === 3 ? 'correction-arrival' : 'pause-arrival', nextScene)
      }
      if (state.phase === 'encounter') {
        return enterBeat(state.beatIndex + 1 < scene.encounter.length
          ? { ...state, beatIndex: state.beatIndex + 1 }
          : { ...state, phase: 'decision', beatIndex: 0, decision: { key: null, status: 'briefing', durationMs: state.mode === 'timed' ? responseWindowsMs[state.chapter] : null, elapsedMs: 0, firedCueIds: [], resolution: null } }, scene)
      }
      if (state.phase === 'consequence') {
        const branch = state.selectedChoice === 'NO_RESPONSE' ? noResponseContent(scene) : scene.choices.find(choice => choice.id === state.selectedChoice)
        if (branch && state.beatIndex + 1 < branch.beats.length) return enterBeat({ ...state, beatIndex: state.beatIndex + 1 }, scene)
        return scene.nextSceneId
          ? enterBeat({ ...state, phase: 'transition', beatIndex: 0,
            firstEncounter: state.chapter === 1 ? rememberFirst(state) : state.firstEncounter,
            secondEncounter: state.chapter === 2 && state.pauseOrder && state.selectedChoice ? { choiceId: state.selectedChoice, colleagueIntervened: state.interventions.pause, order: structuredClone(state.pauseOrder), register: state.register, queue: { ...state.queue } } : state.secondEncounter,
          }, scene)
          : { ...state, phase: 'ending' }
      }
      return state
    }
    case 'REPLAY': return state.phase === 'ending' ? { ...createInitialState(lunchRush, state.mode), phase: 'opening' } : state
    case 'EXIT': return createInitialState(initialScene, state.mode)
  }
}

/** Test/simulation convenience. Production supplies absolute samples from an injected clock. */
export function advanceTime(state: NarrativeState, milliseconds: number): NarrativeState {
  return narrativeReducer(state, { type: 'ADVANCE_TIME', decisionKey: state.decision?.key ?? '', elapsedMs: (state.decision?.elapsedMs ?? 0) + milliseconds })
}
