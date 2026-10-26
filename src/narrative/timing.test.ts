import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { advanceTime, createInitialState, currentBeat, formatStoryTime, narrativeReducer } from './engine'
import { responseWindowsMs, temporalCues } from './decisionContent'
import { scenes } from './story'
import { ActiveClock } from '../timing/ActiveClock'
import type { NarrativeState, PlayMode, ResolutionId } from './types'

const resolutions: ResolutionId[] = ['A', 'B', 'C', 'NO_RESPONSE']
const triples = resolutions.flatMap(a => resolutions.flatMap(b => resolutions.map(c => [a, b, c] as const)))
const advance = (state: NarrativeState) => narrativeReducer(state, { type: 'ADVANCE' })
function briefing(state = narrativeReducer(createInitialState(), { type: 'BEGIN', mode: 'timed' })) {
  state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
  while (state.phase === 'encounter') state = advance(state)
  return state
}
function activate(state = briefing(), key = 'run1:' + state.sceneId) {
  return narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: key })
}
function choose(state: NarrativeState, choiceId: 'A' | 'B' | 'C', elapsedMs = 1234) {
  return narrativeReducer(state, { type: 'CHOOSE', choiceId, decisionKey: state.decision!.key!, elapsedMs })
}
function play(triple: readonly ResolutionId[], mode: PlayMode = 'timed') {
  let state = narrativeReducer(createInitialState(), { type: 'BEGIN', mode })
  const before: NarrativeState[] = [], after: NarrativeState[] = [], lines: string[][] = []
  for (const resolution of triple) {
    state = activate(briefing(state))
    before.push(state)
    state = resolution === 'NO_RESPONSE' ? advanceTime(state, responseWindowsMs[state.chapter]) : choose(state, resolution)
    const dialogue: string[] = []
    while (state.phase === 'consequence') { dialogue.push(currentBeat(state)!.line); state = advance(state) }
    lines.push(dialogue); after.push(state)
    if (state.phase === 'transition') state = advance(state)
  }
  return { state, before, after, lines }
}
const external = (state: NarrativeState) => state.eventLog.filter(e => e.source === 'external')

describe('v0.5 deterministic active time', () => {
  it.each(triples)('preserves the actual world through %s / %s / %s', (first, second, third) => {
    const result = play([first, second, third])
    expect(result).toEqual(play([first, second, third]))
    const { state, before, after } = result
    expect(state.phase).toBe('ending')
    expect(state.decisionHistory.map(h => h.choiceId)).toEqual([first, second, third])
    expect(state.decisionHistory.map(h => h.elapsedMs)).toEqual([first, second, third].map((r, i) => r === 'NO_RESPONSE' ? responseWindowsMs[(i + 1) as 1 | 2 | 3] : 1234))
    expect(state.decisionHistory.map(h => h.storyTimeSeconds)).toEqual([first, second, third].map((r, i) => r === 'NO_RESPONSE' ? responseWindowsMs[(i + 1) as 1 | 2 | 3] / 1000 : 1))
    expect(state.decisionHistory.every(h => h.mode === 'timed')).toBe(true)
    expect(external(state)).toEqual(external(play(['A', 'A', 'A']).state))
    expect(external(state)).toHaveLength(14)
    expect(state.firstEncounter).toEqual(after[0].firstEncounter)
    expect(state.secondEncounter).toEqual(after[1].secondEncounter)
    expect(state.pauseOrder).toEqual(state.secondEncounter!.order)
    expect(state.customerDeadline).toEqual(first === 'B' ? { time: '12:53', meaning: 'return-to-work' } : null)
    if (first === 'NO_RESPONSE') {
      expect(state.firstEncounter).toMatchObject({ choiceId: 'NO_RESPONSE', location: 'aside', orderStatus: 'unplaced', orderItem: null, receipt: null, deadline: null, quotation: null })
      expect(result.lines[0].join(' ')).not.toContain('12:53')
    }
    if (second === 'NO_RESPONSE') {
      expect(after[1]).toMatchObject({ interventions: { pause: true }, register: 'occupied', colleagueHelpingQueue: true, queue: { flow: 'blocked', nextServed: false } })
      expect(state.secondEncounter).toMatchObject({ choiceId: 'NO_RESPONSE', colleagueIntervened: true, order: { total: 25, payment: 'paid', release: 'unreleased', refund: 'none', hold: 'none', activeAtRegister: true } })
      expect(before[2].correction).toMatchObject({ priorChoice: 'NO_RESPONSE', owner: 'you', handoff: null, order: { totalCents: 2500, release: 'unreleased' } })
    } else expect(state.secondEncounter!.colleagueIntervened).toBe(false)
    const c = state.correction!
    const payments = c.ledger.filter(e => e.type === 'payment').reduce((sum, e) => sum + e.cents!, 0)
    const refunds = c.ledger.filter(e => e.type === 'refund').reduce((sum, e) => sum + e.cents!, 0)
    expect(c.order?.preparation ?? 'not-started').toBe('not-started')
    expect(c.order?.collection ?? 'not-collected').toBe('not-collected')
    expect(new Set(c.ledger.map(e => e.id)).size).toBe(c.ledger.length)
    if (third === 'NO_RESPONSE') {
      expect(c).toEqual({ ...before[2].correction, status: 'unanswered' })
      expect(state.register).toBe(before[2].register)
      expect(c.handoff).toBeNull()
      expect(state.interventions).toEqual({ pause: second === 'NO_RESPONSE', correction: true })
      expect(payments - refunds).toBe(second === 'B' ? 0 : 2500)
    } else if (third === 'C') {
      expect(c).toMatchObject({ owner: 'colleague', status: 'handed-over', handoff: { accepted: true, priorChoice: second } })
      expect(c.order).toEqual(before[2].correction!.order)
      expect(payments - refunds).toBe(second === 'B' ? 0 : 2500)
    } else if (second === 'B' && third === 'B') {
      expect(c).toMatchObject({ status: 'awaiting-payment', authorization: { newPayment: false, release: false }, order: { number: 50, totalCents: 1720, payment: 'unpaid', release: 'unreleased' } })
      expect(payments - refunds).toBe(0)
      expect(c.ledger.some(e => e.type.startsWith('ticket'))).toBe(false)
    } else {
      expect(c).toMatchObject({ status: 'released', owner: 'you', authorization: { release: true }, order: { payment: 'paid', release: 'released', totalCents: 1720 } })
      expect(c.order!.items).toHaveLength(2)
      expect(payments - refunds).toBe(1720)
      expect(c.ledger.filter(e => e.type === 'ticket-created')).toHaveLength(1)
      expect(c.ledger.filter(e => e.type === 'ticket-released')).toHaveLength(1)
      const authorization = c.ledger.findIndex(e => e.type === 'customer-authorization')
      expect(authorization).toBeGreaterThanOrEqual(0)
      expect(authorization).toBeLessThan(c.ledger.findIndex(e => e.type === 'ticket-released'))
      if (second === 'C') expect(c.ledger.some(e => e.type === 'ticket-amended')).toBe(true)
      if (second === 'B') expect(c.ledger.filter(e => e.type === 'payment')).toHaveLength(2)
    }
    expect(narrativeReducer(state, { type: 'REPLAY' })).toEqual({ ...createInitialState(undefined, 'timed'), phase: 'opening' })
    expect(narrativeReducer(state, { type: 'EXIT' })).toEqual(createInitialState(undefined, 'timed'))
  })

  it('leaves introductory dialogue untimed, and triggers each cue once at its authored threshold', () => {
    const ready = briefing()
    expect(ready.decision!.status).toBe('briefing')
    expect(advanceTime(ready, 100_000)).toBe(ready)
    expect(choose(ready, 'A')).toBe(ready)
    for (const chapter of [1, 2, 3] as const) {
      const readyForChapter = chapter === 1 ? ready : play(['A', 'A', 'A']).before[chapter - 1]
      let state = activate(readyForChapter)
      const cues = temporalCues(chapter)
      state = advanceTime(state, cues[0].atMs - 1)
      expect(state.decision!.firedCueIds).toEqual([])
      state = advanceTime(state, 1)
      expect(state.decision!.firedCueIds).toEqual([cues[0].id])
      state = advanceTime(state, cues[1].atMs - cues[0].atMs)
      expect(state.decision!.firedCueIds).toEqual(cues.map(c => c.id))
      const identical = narrativeReducer(state, { type: 'ADVANCE_TIME', decisionKey: state.decision!.key!, elapsedMs: state.decision!.elapsedMs })
      expect(identical).toBe(state)
      expect(state.eventLog.filter(e => e.source === 'temporal')).toHaveLength(2)
      expect(formatStoryTime(state.storyTimeMinutes, state.storyTimeSeconds)).toBe(`${chapter === 1 ? '12:43' : chapter === 2 ? '12:46' : '12:49'}:${String(Math.floor(cues[1].atMs / 1000)).padStart(2, '0')} PM`)
    }
  })

  it('resolves boundary races atomically, rejects duplicates and stale runs, and never invents a button', () => {
    const initial = activate()
    const before = choose(initial, 'B', 34_999.9)
    expect(before.selectedChoice).toBe('B')
    expect(advanceTime(before, 100_000)).toBe(before)
    expect(choose(before, 'C', 35_000)).toBe(before)
    for (const elapsed of [35_000, 35_001, 1_000_000]) {
      const late = choose(initial, 'A', elapsed)
      expect(late.selectedChoice).toBe('NO_RESPONSE')
      expect(late.decisionHistory).toHaveLength(1)
      expect(late.orderItem).toBeNull()
      expect(late.decision!.elapsedMs).toBe(35_000)
    }
    for (const elapsed of [NaN, Infinity, -1]) expect(choose(initial, 'A', elapsed)).toBe(initial)
    const stale = { type: 'ADVANCE_TIME' as const, decisionKey: initial.decision!.key!, elapsedMs: 35_000 }
    const title = narrativeReducer(initial, { type: 'EXIT' })
    const restarted = activate(briefing(narrativeReducer(title, { type: 'BEGIN' })), 'run2:lunch')
    expect(narrativeReducer(restarted, stale)).toBe(restarted)
    expect(narrativeReducer(restarted, { type: 'CHOOSE', choiceId: 'A', decisionKey: stale.decisionKey, elapsedMs: 1 })).toBe(restarted)
    expect(scenes.every(s => s.choices.length === 3)).toBe(true)
  })

  it('retains all 27 reflective histories without timing, cues or comparable latency measurements', () => {
    for (const triple of triples.filter(t => !t.includes('NO_RESPONSE'))) {
      const result = play(triple, 'reflective')
      expect(result.state.phase).toBe('ending')
      expect(result.state.decisionHistory.every(h => h.mode === 'reflective' && h.elapsedMs === null && h.cueIds.length === 0)).toBe(true)
      for (const state of result.before) expect(advanceTime(state, 1_000_000)).toBe(state)
      expect(narrativeReducer(result.state, { type: 'REPLAY' }).mode).toBe('reflective')
    }
  })

  it('counts only visible, unsuspended time through a shared injected monotonic clock', () => {
    let now = 0
    const clock = new ActiveClock({ now: () => now })
    now = 6000; expect(clock.sample()).toBe(6000)
    clock.setSuspended(true)
    now = 100_000; expect(clock.sample()).toBe(6000)
    clock.setSuspended(false)
    now += 1000; expect(clock.sample()).toBe(7000)
    now -= 500; expect(clock.sample()).toBe(7000)
    now += 1000; expect(clock.sample()).toBe(7500)
    now = NaN; expect(clock.sample()).toBe(7500)
  })

  it('preserves the complete original v0.4 scene content and every original served media byte', () => {
    const withoutTimeoutVariants = (_key: string, value: unknown) => {
      if (value && typeof value === 'object' && 'NO_RESPONSE' in value) {
        const { NO_RESPONSE: _timeout, ...original } = value
        return original
      }
      return value
    }
    expect(JSON.parse(JSON.stringify(scenes, withoutTimeoutVariants))).toEqual(JSON.parse(readFileSync('docs/archive/v0.4/scenes.json', 'utf8')))
    const media = JSON.parse(readFileSync('docs/archive/v0.4/media-hashes.json', 'utf8')) as { Path: string; Hash: string }[]
    expect(media).toHaveLength(65)
    for (const file of media) expect(createHash('sha256').update(readFileSync(file.Path)).digest('hex').toUpperCase()).toBe(file.Hash)
  })
})
