import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createInitialState, currentBeat, narrativeReducer } from './engine'
import { lunchRush, thePause, theCorrection } from './story'
import { revisedRequest } from './correction'
import { applyCorrectionAction } from './revision'
import type { ChoiceId, NarrativeState } from './types'

const ids: ChoiceId[] = ['A', 'B', 'C']
const triples = ids.flatMap(first => ids.flatMap(second => ids.map(third => [first, second, third] as const)))
const advance = (state: NarrativeState) => narrativeReducer(state, { type: 'ADVANCE' })
function play(first: ChoiceId, second: ChoiceId, third: ChoiceId) {
  let state = narrativeReducer(createInitialState(), { type: 'BEGIN' })
  const trace: NarrativeState[] = []
  const openings: string[] = []
  let before: NarrativeState | undefined
  for (const choiceId of [first, second, third]) {
    state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
    while (state.phase === 'encounter') {
      if (state.chapter === 3) openings.push(currentBeat(state)!.line)
      trace.push(state); state = advance(state)
    }
    state = narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'test:' + state.sceneId })
    if (state.chapter === 3) before = state
    state = narrativeReducer(state, { type: 'CHOOSE', choiceId })
    while (state.phase === 'consequence') { trace.push(state); state = advance(state) }
    if (state.phase === 'transition') state = advance(state)
  }
  return { state, trace, openings, before: before! }
}

describe('The Correction: revisions retain the actual transaction history', () => {
  it('preserves all original authored Chapter I and II content, with only a new Chapter II handover', () => {
    const baseline = JSON.parse(readFileSync('docs/archive/v0.3.1/scenes.json', 'utf8'))
    const { nextSceneId: _next, transitions: _transitions, ...oldPause } = thePause
    expect(JSON.parse(JSON.stringify(lunchRush))).toEqual(baseline[0])
    expect(JSON.parse(JSON.stringify(oldPause))).toEqual(baseline[1])
  })
  it.each(triples)('completes %s/%s/%s deterministically without erasing earlier facts', (first, second, third) => {
    const result = play(first, second, third)
    expect(result).toEqual(play(first, second, third))
    const { state, before } = result
    expect(state).toMatchObject({ chapter: 3, phase: 'ending', storyTimeMinutes: 769, kitchen: { estimateMinutes: 13, grillStatus: 'backed-up' } })
    expect(state.decisionHistory.map(({ sceneId, choiceId }) => ({ sceneId, choiceId }))).toEqual([{ sceneId: lunchRush.id, choiceId: first }, { sceneId: thePause.id, choiceId: second }, { sceneId: theCorrection.id, choiceId: third }])
    expect(state.firstEncounter).toEqual(before.firstEncounter)
    expect(state.firstEncounter?.location).toBe(first === 'A' ? 'pickup' : first === 'B' ? 'aside' : 'left')
    expect(state.customerDeadline).toEqual(first === 'B' ? { time: '12:53', meaning: 'return-to-work' } : null)
    expect(state.secondEncounter).toEqual(before.secondEncounter)
    expect(state.pauseOrder).toEqual(state.secondEncounter?.order)
    expect(state.pauseOrder?.request?.sentDespiteRequest).toBe(second === 'C')
    expect(before.correction?.request).toEqual({ text: revisedRequest, chickenMeals: 2, totalCents: 1720, removedCents: 780 })
    expect(result.openings[1]).toBe(revisedRequest)
    expect(result.openings[2]).toBe(second === 'A' ? "You've kept it open all this time?" : second === 'B' ? "Oh, you've refunded it? I thought we were waiting." : 'You sent something through? I asked you to wait.')
    const c = state.correction!
    expect(new Set(c.ledger.map(entry => entry.id)).size).toBe(c.ledger.length)
    const payments = c.ledger.filter(entry => entry.type === 'payment')
    const refunds = c.ledger.filter(entry => entry.type === 'refund')
    const net = payments.reduce((sum, entry) => sum + entry.cents!, 0) - refunds.reduce((sum, entry) => sum + entry.cents!, 0)
    if (third === 'C') {
      expect(c).toMatchObject({ status: 'handed-over', owner: 'colleague', handoff: { accepted: true, originalRequest: thePause.encounter[1].line, revisedRequest, priorChoice: second } })
      expect(c.handoff?.remainingActions).toHaveLength(3)
      expect(c.order?.items ?? []).toHaveLength(second === 'B' ? 0 : 3)
    } else if (second === 'B' && third === 'B') {
      expect(c).toMatchObject({ status: 'awaiting-payment', order: { number: 50, payment: 'unpaid', release: 'unreleased', totalCents: 1720 }, authorization: { newPayment: false, release: false } })
      expect(payments).toHaveLength(1)
      expect(c.ledger.some(entry => entry.type.startsWith('ticket'))).toBe(false)
      expect(net).toBe(0)
    } else {
      expect(c).toMatchObject({ status: 'released', order: { number: second === 'B' ? 50 : 49, payment: 'paid', release: 'released', totalCents: 1720 }, authorization: { release: true } })
      expect(c.order?.items).toHaveLength(2)
      expect(net).toBe(1720)
      expect(c.ledger.filter(entry => entry.type === 'ticket-created')).toHaveLength(1)
      expect(c.ledger.filter(entry => entry.type === 'ticket-released')).toHaveLength(1)
      if (second === 'B') {
        expect(c.authorization.newPayment).toBe(true)
        expect(refunds).toMatchObject([{ cents: 2500, order: 49 }])
        expect(payments).toHaveLength(2)
      } else {
        expect(payments).toHaveLength(1)
        expect(refunds).toMatchObject([{ cents: 780, order: 49 }])
      }
      if (second === 'C') expect(c.ledger.filter(entry => entry.type === 'ticket-amended')).toMatchObject([{ order: 49, items: 2 }])
    }
    if (third === 'C') {
      expect(net).toBe(second === 'B' ? 0 : 2500)
      expect(c.order).toEqual(before.correction?.order)
      if (second === 'B') expect(c.order).toBeNull()
      expect(c.ledger.some(entry => entry.id === '049-adjustment' || entry.id === '050-payment')).toBe(false)
    }
    expect(state.register).toBe('free')
    expect(state.queue).toMatchObject({ nextServed: true, flow: 'moving', arrivals: 1 })
    for (const step of result.trace.filter(step => step.chapter === 3)) {
      const revision = step.correction!
      if (revision.order) expect(revision.order).toMatchObject({ preparation: 'not-started', collection: 'not-collected' })
      const authIndex = revision.ledger.findIndex(entry => entry.type === 'customer-authorization')
      const releaseIndex = revision.ledger.findIndex(entry => entry.type === 'ticket-released')
      const newPayIndex = revision.ledger.findIndex(entry => entry.id === '050-payment')
      if (releaseIndex >= 0) { expect(authIndex).toBeGreaterThanOrEqual(0); expect(authIndex).toBeLessThan(releaseIndex) }
      if (newPayIndex >= 0) { expect(authIndex).toBeGreaterThanOrEqual(0); expect(authIndex).toBeLessThan(newPayIndex) }
      expect(revision.ledger.filter(entry => entry.id === '049-adjustment').length).toBeLessThanOrEqual(1)
    }
    expect(narrativeReducer(state, { type: 'REPLAY' })).toEqual({ ...createInitialState(), phase: 'opening' })
    expect(narrativeReducer(state, { type: 'EXIT' })).toEqual(createInitialState())
    expect(advance(state)).toBe(state)
  })
  it('has identical external events and information across all 27 paths', () => {
    const external = (state: NarrativeState) => state.eventLog.filter(event => event.source === 'external')
    const expected = external(play('A', 'A', 'A').state)
    expect(expected).toHaveLength(14)
    for (const triple of triples) expect(external(play(...triple).state)).toEqual(expected)
  })
  it('explains before any operation; immediate correction still waits at authorization boundaries', () => {
    for (const second of ids) {
      const explain = play('C', second, 'A')
      const first = explain.trace.find(step => step.chapter === 3 && step.phase === 'consequence')!
      expect(first.correction?.ledger).toEqual(explain.before.correction?.ledger)
      expect(first.correction?.order).toEqual(explain.before.correction?.order)
      const now = play('C', second, 'B').trace.find(step => step.chapter === 3 && step.phase === 'consequence')!
      expect(now.correction?.authorization.release).toBe(false)
      expect(now.correction?.order?.release).toBe(second === 'C' ? 'held' : 'unreleased')
      expect(applyCorrectionAction(now, 'complete-correction')).toBe(now)
    }
  })
  it('ignores duplicate third decisions, does not mutate inputs, and resets on Exit from any beat', () => {
    const decision = play('B', 'C', 'A').before
    const copy = structuredClone(decision)
    const committed = narrativeReducer(decision, { type: 'CHOOSE', choiceId: 'B' })
    expect(decision).toEqual(copy)
    expect(narrativeReducer(committed, { type: 'CHOOSE', choiceId: 'C' })).toBe(committed)
    expect(committed.decisionHistory).toHaveLength(3)
    for (const step of play('B', 'C', 'C').trace) expect(narrativeReducer(step, { type: 'EXIT' })).toEqual(createInitialState())
  })
})
