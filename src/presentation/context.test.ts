import { describe, expect, it } from 'vitest'
import { createInitialState, narrativeReducer } from '../narrative/engine'
import type { ChoiceId, NarrativeState } from '../narrative/types'
import { currentOrderFacts, immediateSituation, pendingWork } from './context'

const advance = (state: NarrativeState) => narrativeReducer(state, { type: 'ADVANCE' })
function decision(state: NarrativeState) {
  state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
  while (state.phase === 'encounter') state = advance(state)
  return narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'context:' + state.sceneId })
}
function resolve(state: NarrativeState, choice: ChoiceId) {
  state = narrativeReducer(decision(state), { type: 'CHOOSE', choiceId: choice })
  while (state.phase === 'consequence') state = advance(state)
  return state.phase === 'transition' ? advance(state) : state
}
function correction(second: ChoiceId) {
  return resolve(resolve(narrativeReducer(createInitialState(), { type: 'BEGIN', mode: 'reflective' }), 'B'), second)
}

describe('Review preserves what is known, done and still pending', () => {
  it('does not invent an exact deadline or travel time before clarification', () => {
    const state = createInitialState()
    expect(currentOrderFacts(state)).toContain('deadline is unknown')
    expect(pendingWork(state)).toContain('travel time is unknown')
    expect([currentOrderFacts(state), immediateSituation(state), pendingWork(state)].join(' ')).not.toContain('12:53')
  })
  it.each(['A', 'B', 'C'] as const)('does not reveal the revised request before its dialogue after %s', second => {
    let state = correction(second)
    state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
    expect(state.correction?.request).toBeNull()
    expect(pendingWork(state)).toContain('No revised request')
    state = advance(state)
    expect(state.correction?.request).not.toBeNull()
    expect(pendingWork(state)).not.toContain('No revised request')
  })
  it('distinguishes paid unsent meals, a refunded order and a kitchen HOLD', () => {
    expect(currentOrderFacts(decision(correction('A')))).toContain('€25.00 paid · unreleased')
    expect(currentOrderFacts(decision(correction('B')))).toContain('€25.00 returned')
    expect(currentOrderFacts(decision(correction('C')))).toContain('on kitchen HOLD')
  })
  it('keeps an unpaid draft distinct from an authorized fresh payment', () => {
    let state = narrativeReducer(decision(correction('B')), { type: 'CHOOSE', choiceId: 'B' })
    expect(currentOrderFacts(state)).toContain('Order 50: 2 meals · €17.20 unpaid')
    expect(pendingWork(state)).toContain('payment authorization')
    expect(pendingWork(state)).toContain('permission to release')
  })
  it('does not ask for a second refund once the €7.80 adjustment has happened', () => {
    const state = narrativeReducer(decision(correction('C')), { type: 'CHOOSE', choiceId: 'B' })
    expect(pendingWork(state)).toContain('€7.80 returned')
    expect(pendingWork(state)).not.toContain('return €7.80')
    expect(pendingWork(state)).toContain('Permission to release')
  })
  it('does not claim an offered handoff has transferred responsibility', () => {
    let state = narrativeReducer(decision(correction('A')), { type: 'CHOOSE', choiceId: 'C' })
    expect(state.correction?.handoff?.accepted).toBe(false)
    expect(pendingWork(state)).not.toContain('has accepted responsibility')
    state = advance(state)
    expect(pendingWork(state)).toContain('has accepted responsibility')
    expect(pendingWork(state)).toContain('unfinished')
  })
})
