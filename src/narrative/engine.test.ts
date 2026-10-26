import { describe, expect, it } from 'vitest'
import { createInitialState, currentBeat, formatStoryTime, narrativeReducer } from './engine'
import { lunchRush } from './story'
import type { ChoiceId, NarrativeState, SceneDefinition } from './types'

function atDecision(scene: SceneDefinition = lunchRush) {
  let state = narrativeReducer(createInitialState(scene), { type: 'BEGIN' }, scene)
  state = narrativeReducer(state, { type: 'OPENING_COMPLETE' }, scene)
  state = narrativeReducer(state, { type: 'ADVANCE' }, scene)
  return narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'test:' + scene.id }, scene)
}
function play(choiceId: ChoiceId) {
  let state = narrativeReducer(atDecision(), { type: 'CHOOSE', choiceId })
  const trace: { state: NarrativeState; line: string | undefined }[] = []
  while (state.phase === 'consequence') {
    trace.push({ state, line: currentBeat(state)?.line })
    state = narrativeReducer(state, { type: 'ADVANCE' })
  }
  return { state, trace }
}
function finishShift(first: ChoiceId, second: ChoiceId) {
  let state = narrativeReducer(play(first).state, { type: 'ADVANCE' })
  state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
  while (state.phase === 'encounter') state = narrativeReducer(state, { type: 'ADVANCE' })
  state = narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'test:pause' })
  state = narrativeReducer(state, { type: 'CHOOSE', choiceId: second })
  while (state.phase === 'consequence') state = narrativeReducer(state, { type: 'ADVANCE' })
  state = narrativeReducer(state, { type: 'ADVANCE' })
  state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
  while (state.phase === 'encounter') state = narrativeReducer(state, { type: 'ADVANCE' })
  state = narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'test:correction' })
  state = narrativeReducer(state, { type: 'CHOOSE', choiceId: 'A' })
  while (state.phase === 'consequence') state = narrativeReducer(state, { type: 'ADVANCE' })
  return state
}
const ids: ChoiceId[] = ['A', 'B', 'C']

describe('one lunch rush, three coherent consequences', () => {
  it('starts at 12:43 with an estimate, an alternative and no assumed deadline', () => {
    expect(formatStoryTime(createInitialState().storyTimeMinutes)).toBe('12:43 PM')
    expect(createInitialState()).toMatchObject({ phase: 'title', preparationEstimate: 8, customerDeadline: null, decisionHistory: [], eventLog: [] })
    expect(createInitialState().availableAlternatives[0].available).toBe(true)
  })
  it('never advances unread dialogue from irrelevant events', () => {
    const state = atDecision()
    expect(narrativeReducer(state, { type: 'OPENING_COMPLETE' })).toBe(state)
    expect(narrativeReducer(state, { type: 'ADVANCE' })).toBe(state)
    expect(narrativeReducer(state, { type: 'REPLAY' })).toBe(state)
  })
  it('A enters a hot order, preserves its receipt and exposes it to the shared delay', () => {
    const { state, trace } = play('A')
    expect(trace.map(step => step.state.orderStatus)).toEqual(['entered', 'delayed', 'delayed'])
    expect(trace.map(step => step.state.preparationEstimate)).toEqual([8, 13, 13])
    expect(state.receipt).toEqual({ number: 48, estimateAtEntry: 8, timeAtEntry: 763 })
    expect(trace.at(-1)?.line).toBe("That may be too long. I might have to leave before it's ready.")
    expect(state.customerDeadline).toBeNull()
    expect(state.currentConsequence).toBe('proceed')
  })
  it('B retains the return-to-work fact and stays uncommitted when the grill changes', () => {
    const { state, trace } = play('B')
    expect(trace.map(step => step.state.preparationEstimate)).toEqual([8, 13, 13])
    expect(state).toMatchObject({ orderStatus: 'pending', preparationEstimate: 13, receipt: null, customerDeadline: { time: '12:53', meaning: 'return-to-work' } })
    expect(trace[0].line).toBe("I need to be back at work at 12:53. That's when my break ends.")
    expect(trace.every(step => step.state.customerDeadline?.meaning === 'return-to-work')).toBe(true)
  })
  it('C retains the grill delay while handing over an independent ready item', () => {
    const { state, trace } = play('C')
    expect(trace.map(step => step.state.orderStatus)).toEqual(['ready', 'ready', 'handed-off'])
    expect(state).toMatchObject({ orderStatus: 'handed-off', orderItem: 'chicken-wrap', preparationEstimate: 0, customerDeadline: null, receipt: null, kitchen: { estimateMinutes: 13 } })
    expect(trace[0].line).toContain('Not what I had in mind')
    expect(currentBeat(trace[2].state)?.cue).toBe('handoff')
  })
  it('authors the exact same external sequence, notice and queue progression across branches', () => {
    const results = ids.map(id => play(id))
    const external = (state: NarrativeState) => state.eventLog.filter(event => event.source === 'external')
    expect(external(results[0].state)).toEqual(external(results[1].state))
    expect(external(results[1].state)).toEqual(external(results[2].state))
    for (const { state, trace } of results) {
      expect(trace[1].line).toBe("Grill's backed up. Thirteen minutes on hot orders.")
      expect(trace.map(step => step.state.storyTimeMinutes)).toEqual([763, 764, 764])
      expect(state.queue).toMatchObject({ first: 'left', second: 'advanced' })
      expect(state.kitchen).toEqual({ estimateMinutes: 13, grillStatus: 'backed-up', calledOrder: null })
      expect(external(state)).toHaveLength(5)
    }
  })
  it('keeps player actions distinct from external events and discovered customer facts', () => {
    const actions = ids.map(id => play(id).state.eventLog.filter(event => event.source === 'player'))
    expect(actions).toEqual([
      [{ source: 'player', action: 'enter-hot-order' }],
      [{ source: 'player', action: 'seek-clarification' }],
      [{ source: 'player', action: 'offer-wrap' }, { source: 'player', action: 'hand-off-wrap' }],
    ])
  })
  it.each(ids)('reproduces every beat and outcome for %s', id => {
    expect(play(id)).toEqual(play(id))
    expect(play(id).state.decisionHistory.map(({ sceneId, choiceId }) => ({ sceneId, choiceId }))).toEqual([{ sceneId: lunchRush.id, choiceId: id }])
  })
  it('ignores early, duplicate, and conflicting choice submissions', () => {
    const initial = createInitialState()
    expect(narrativeReducer(initial, { type: 'CHOOSE', choiceId: 'A' })).toBe(initial)
    const committed = narrativeReducer(atDecision(), { type: 'CHOOSE', choiceId: 'B' })
    expect(narrativeReducer(committed, { type: 'CHOOSE', choiceId: 'C' })).toBe(committed)
    expect(committed.decisionHistory).toHaveLength(1)
  })
  it.each(ids)('replay completely resets %s and exit returns to title', id => {
    const state = finishShift(id, 'A')
    expect(narrativeReducer(state, { type: 'REPLAY' })).toEqual({ ...createInitialState(), phase: 'opening' })
    expect(narrativeReducer(state, { type: 'EXIT' })).toEqual(createInitialState())
    expect(narrativeReducer(state, { type: 'ADVANCE' })).toBe(state)
  })
  it('does not share mutable state between runs or mutate input state', () => {
    const first = atDecision()
    const before = structuredClone(first)
    narrativeReducer(first, { type: 'CHOOSE', choiceId: 'A' })
    expect(first).toEqual(before)
    const second = createInitialState()
    second.queue.second = 'advanced'
    second.kitchen.estimateMinutes = 99
    second.availableAlternatives[0].available = false
    expect(createInitialState()).toMatchObject({ kitchen: { estimateMinutes: 8 }, queue: { second: 'offstage' }, availableAlternatives: [{ available: true }] })
  })
  it('uses supplied scenario conditions rather than hardcoded branch effects', () => {
    const scene: SceneDefinition = { ...lunchRush, id: 'future-chapter', initialEstimate: 6, conditions: { startTimeMinutes: 720, returnToWorkMinutes: 735 } }
    const state = narrativeReducer(atDecision(scene), { type: 'CHOOSE', choiceId: 'B' }, scene)
    expect(state).toMatchObject({ sceneId: 'future-chapter', preparationEstimate: 6, customerDeadline: { time: '12:15' }, storyTimeMinutes: 720 })
    expect(state.decisionHistory[0].sceneId).toBe('future-chapter')
  })
  it('does not repeat world events when a presentation beat reuses a timeline mark', () => {
    const scene: SceneDefinition = { ...lunchRush, choices: lunchRush.choices.map(choice => ({ ...choice, beats: [choice.beats[0], choice.beats[1], choice.beats[1]] })) }
    let state = narrativeReducer(atDecision(scene), { type: 'CHOOSE', choiceId: 'A' }, scene)
    state = narrativeReducer(state, { type: 'ADVANCE' }, scene)
    const world = structuredClone({ kitchen: state.kitchen, queue: state.queue, time: state.storyTimeMinutes, events: state.eventLog })
    state = narrativeReducer(state, { type: 'ADVANCE' }, scene)
    expect({ kitchen: state.kitchen, queue: state.queue, time: state.storyTimeMinutes, events: state.eventLog }).toEqual(world)
  })
  it('keeps reflective decisions independent of elapsed time, audio and animation', () => {
    expect(lunchRush.choices.every(choice => choice.beats.length === 3)).toBe(true)
    const state = atDecision()
    // Advancing presentation clocks cannot submit a decision; the reducer receives only authored controls.
    for (let i = 0; i < 100; i++) expect(narrativeReducer(state, { type: 'ADVANCE' })).toBe(state)
    expect(formatStoryTime(state.storyTimeMinutes)).toBe('12:43 PM')
  })
})
