import { describe, expect, it } from 'vitest'
import { createInitialState, currentBeat, narrativeReducer } from './engine'
import { lunchRush, thePause } from './story'
import type { ChoiceId, NarrativeState } from './types'

const ids: ChoiceId[] = ['A','B','C']
const pairs = ids.flatMap(first => ids.map(second => [first, second] as const))
const advance = (state: NarrativeState) => narrativeReducer(state, { type: 'ADVANCE' })
function start() {
  return narrativeReducer(narrativeReducer(createInitialState(), { type: 'BEGIN' }), { type: 'OPENING_COMPLETE' })
}
function firstOutcome(choiceId: ChoiceId) {
  let state = advance(start())
  state = narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'test:lunch' })
  state = narrativeReducer(state, { type: 'CHOOSE', choiceId })
  while (state.phase === 'consequence') state = advance(state)
  return state
}
function pauseDecision(first: ChoiceId) {
  let state = narrativeReducer(advance(firstOutcome(first)), { type: 'OPENING_COMPLETE' })
  const setup: NarrativeState[] = []
  while (state.phase === 'encounter') { setup.push(state); state = advance(state) }
  state = narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'test:pause' })
  return { state, setup }
}
function play(first: ChoiceId, second: ChoiceId) {
  let state = narrativeReducer(pauseDecision(first).state, { type: 'CHOOSE', choiceId: second })
  const trace: NarrativeState[] = []
  while (state.phase === 'consequence') { trace.push(state); state = advance(state) }
  return { state, trace }
}
const external = (state: NarrativeState) => state.eventLog.filter(event => event.source === 'external')

describe('The Pause continues the same shift', () => {
  it.each(ids)('preserves first outcome %s in an explicit player-paced handover', id => {
    const state = firstOutcome(id)
    expect(state.phase).toBe('transition')
    expect(currentBeat(state)?.line).toBe(lunchRush.transitions[id].line)
    expect(state.firstEncounter).toMatchObject({ choiceId: id, location: id === 'A' ? 'pickup' : id === 'B' ? 'aside' : 'left' })
    expect(state.firstEncounter?.orderStatus).toBe(id === 'A' ? 'delayed' : id === 'B' ? 'pending' : 'handed-off')
    expect(state.firstEncounter?.quotation).toEqual(id === 'B' ? { id: 'Q-048', payment: 'unpaid', release: 'unsent', item: 'hot-meal' } : null)
    const next = advance(state)
    expect(next).toMatchObject({ chapter: 2, sceneId: thePause.id, phase: 'opening', selectedChoice: null, storyTimeMinutes: 766, kitchen: { grillStatus: 'backed-up', estimateMinutes: 13 } })
    expect(next.firstEncounter).toEqual(state.firstEncounter)
  })
  it('enters and pays for three items before recording the explicit request', () => {
    const { state, setup } = pauseDecision('B')
    expect(setup[0].pauseOrder).toMatchObject({ payment: 'paid', release: 'unreleased', activeAtRegister: true, total: 25, request: null })
    expect(setup[0].pauseOrder?.items).toHaveLength(3)
    expect(setup[1].pauseOrder?.request).toEqual({ text: thePause.encounter[1].line, doNotSend: true, sentDespiteRequest: false })
    expect(state).toMatchObject({ phase: 'decision', register: 'occupied', managerExpectsMovingLine: true })
    expect(state.firstEncounter?.quotation?.payment).toBe('unpaid')
    expect(state.pauseOrder?.payment).toBe('paid')
    expect(thePause.encounter[3].operationalNote).toContain('refund frees it')
    expect(thePause.encounter[3].operationalNote).toContain('sends the order')
  })
  it.each(pairs)('keeps two-decision history %s/%s coherent and deterministic', (first, second) => {
    const result = play(first, second)
    expect(result).toEqual(play(first, second))
    expect(result.state).toMatchObject({ chapter: 2, phase: 'transition', storyTimeMinutes: 767, kitchen: { estimateMinutes: 13, grillStatus: 'backed-up', calledOrder: 46 } })
    expect(result.state.decisionHistory.map(({ sceneId, choiceId }) => ({ sceneId, choiceId }))).toEqual([{ sceneId: lunchRush.id, choiceId: first }, { sceneId: thePause.id, choiceId: second }])
    expect(result.state.firstEncounter).toEqual(firstOutcome(first).firstEncounter)
    expect(result.state.customerDeadline).toEqual(first === 'B' ? { time: '12:53', meaning: 'return-to-work' } : null)
    expect(result.trace.map(state => state.storyTimeMinutes)).toEqual([766, 767, 767])
    expect(result.state.pauseOrder?.preparation).toBe('not-started')
    expect(result.state.pauseOrder?.items.map(item => item.name)).toEqual(['Hot chicken meal','Hot chicken meal','Vegetable meal'])
    expect(result.state.queue.arrivals).toBe(1)
    expect(result.state.managerExpectsMovingLine).toBe(true)
    if (second === 'A') expect(result.state).toMatchObject({ register: 'occupied', colleagueHelpingQueue: true, pauseOrder: { payment: 'paid', release: 'unreleased', refund: 'none', hold: 'none', activeAtRegister: true }, queue: { nextServed: false, flow: 'blocked' } })
    if (second === 'B') expect(result.state).toMatchObject({ register: 'free', pauseOrder: { payment: 'refunded', release: 'unreleased', refund: 'complete', hold: 'none', activeAtRegister: false }, queue: { nextServed: true, flow: 'moving' } })
    if (second === 'C') expect(result.state).toMatchObject({ register: 'free', pauseOrder: { payment: 'paid', release: 'sent', hold: 'all-items', refund: 'none', activeAtRegister: false, request: { doNotSend: true, sentDespiteRequest: true } }, queue: { nextServed: true, flow: 'moving' } })
    expect(result.state.pauseOrder?.request?.sentDespiteRequest).toBe(second === 'C')
    expect(narrativeReducer(result.state, { type: 'REPLAY' })).toBe(result.state)
    expect(narrativeReducer(result.state, { type: 'EXIT' })).toEqual(createInitialState())
  })
  it('has the same external event trace, time and shared pickup line for all nine histories', () => {
    const expected = external(play('A','A').state)
    for (const [first, second] of pairs) {
      const result = play(first, second)
      expect(external(result.state)).toEqual(expected)
      expect(currentBeat(result.trace[1])?.line).toBe('Order forty-six. Ready for collection.')
    }
    expect(expected).toHaveLength(12)
  })
  it('guards the second decision against early, duplicate and conflicting submissions', () => {
    const before = advance(firstOutcome('C'))
    expect(narrativeReducer(before, { type: 'CHOOSE', choiceId: 'A' })).toBe(before)
    const committed = narrativeReducer(pauseDecision('C').state, { type: 'CHOOSE', choiceId: 'C' })
    expect(narrativeReducer(committed, { type: 'CHOOSE', choiceId: 'B' })).toBe(committed)
    expect(committed.pauseOrder?.payment).toBe('paid')
    expect(committed.decisionHistory).toHaveLength(2)
  })
  it('leaves the full request and original order details in refund history', () => {
    const before = pauseDecision('B').state
    const after = play('B','B').state
    expect(after.pauseOrder?.items).toEqual(before.pauseOrder?.items)
    expect(after.pauseOrder?.request).toEqual(before.pauseOrder?.request)
    expect(after.firstEncounter?.quotation?.release).toBe('unsent')
    expect(after.pauseOrder?.release).toBe('unreleased')
  })
})
