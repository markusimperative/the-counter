import { describe, expect, it } from 'vitest'
import { advanceTime, createInitialState, narrativeReducer } from '../narrative/engine'
import type { ResolutionId } from '../narrative/types'
import { clarityOptions, emptyAnswers, hasInvitation, knownEntry, newReflection, reflectionReducer, responseRecord, toggleClarity } from './model'
import { playEnding } from './testFixtures'

const id = '52dc1e0c-66af-4fc7-a37a-b95843377a30'
describe('After the Shift', () => {
  it('invites all 64 deterministic histories and rejects further clock or gameplay changes', () => {
    const choices: ResolutionId[] = ['A','B','C','NO_RESPONSE']
    let count = 0
    for (const a of choices) for (const b of choices) for (const c of choices) {
      const ending = playEnding([a,b,c])
      expect(hasInvitation(ending)).toBe(true)
      expect(ending).toEqual(playEnding([a,b,c]))
      expect(advanceTime(ending, 1_000_000)).toBe(ending)
      expect(narrativeReducer(ending, { type: 'CHOOSE', choiceId: 'A' })).toBe(ending)
      expect(narrativeReducer(ending, { type: 'REPLAY' })).toEqual({ ...createInitialState(undefined, 'timed'), phase: 'opening' })
      expect(narrativeReducer(ending, { type: 'EXIT' })).toEqual(createInitialState(undefined, 'timed'))
      count++
    }
    expect(count).toBe(64)
    expect(hasInvitation(createInitialState())).toBe(false)
    expect(hasInvitation(playEnding(['C','C','C'], 'reflective'))).toBe(true)
  })
  it('preserves edited answers on Back, Next, Skip and return to the invitation', () => {
    let state = reflectionReducer(newReflection(), { type: 'OPEN' })
    state = reflectionReducer(state, { type: 'ANSWER', key: 'interpretation', value: 'Several requests were still open.' })
    state = reflectionReducer(state, { type: 'NEXT' })
    state = reflectionReducer(state, { type: 'ANSWER', key: 'influences', value: 'The queue.' })
    state = reflectionReducer(state, { type: 'BACK' })
    expect(state.answers.interpretation).toBe('Several requests were still open.')
    state = reflectionReducer(state, { type: 'BACK' })
    expect(state.page).toBe('invitation')
    state = reflectionReducer(state, { type: 'OPEN' })
    state = reflectionReducer(state, { type: 'SKIP' })
    expect(state.answers.interpretation).toBe('Several requests were still open.')
    expect(state.answers.influences).toBe('The queue.')
    expect(state.index).toBe(1)
  })
  it('allows every question to be skipped and Finish to open consent without submitting', () => {
    let state = reflectionReducer(newReflection(), { type: 'OPEN' })
    for (let i = 0; i < 6; i++) state = reflectionReducer(state, { type: 'SKIP' })
    expect(state.page).toBe('consent')
    expect(state.answers).toEqual(emptyAnswers())
    expect(reflectionReducer(state, { type: 'BACK' })).toMatchObject({ page: 'question', index: 5 })
    expect(newReflection()).toEqual({ page: 'invitation', index: 0, answers: emptyAnswers() })
  })
  it('keeps Nothing exclusive while allowing multiple difficulties and neutral uncertainty', () => {
    let result = toggleClarity([], clarityOptions[0])
    result = toggleClarity(result, clarityOptions[3])
    expect(result).toEqual([clarityOptions[0], clarityOptions[3]])
    result = toggleClarity(result, clarityOptions[4])
    expect(result).toEqual([clarityOptions[4]])
    expect(toggleClarity(result, clarityOptions[5])).toEqual([clarityOptions[5]])
    expect(toggleClarity(result, clarityOptions[4])).toEqual([])
  })
  it('records no optional context without its specific consent and never mutates narrative or answers', () => {
    const ending = playEnding()
    const before = structuredClone(ending)
    const answers = { ...emptyAnswers(), interpretation: 'An unanswered request.' }
    const record = responseRecord(id, ending, answers, { answers: true, decisionHistory: false, entryRoute: false }, 'unprimed-pilot')
    expect(record).not.toHaveProperty('decisionHistory')
    expect(record).not.toHaveProperty('entryRoute')
    answers.interpretation = 'Changed draft'
    expect(record.answers.interpretation).toBe('An unanswered request.')
    expect(ending).toEqual(before)
    expect(() => responseRecord(id, ending, answers, { answers: false, decisionHistory: true, entryRoute: true }, 'unprimed-pilot')).toThrow()
    expect(() => responseRecord(id, createInitialState(), answers, { answers: true, decisionHistory: false, entryRoute: false }, null)).toThrow()
  })
  it('includes only consented history and known entry-link context', () => {
    const ending = playEnding(['NO_RESPONSE','A','B'])
    const record = responseRecord(id, ending, emptyAnswers(), { answers: true, decisionHistory: true, entryRoute: true }, knownEntry('?entry=unprimed-pilot'))
    expect(record.decisionHistory).toEqual(ending.decisionHistory)
    expect(record.entryRoute).toEqual({ value: 'unprimed-pilot', source: 'entry-link' })
    for (const query of ['', '?entry=elsewise-article','?entry=unknown']) expect(knownEntry(query)).toBeNull()
    expect(responseRecord(id, ending, emptyAnswers(), { answers: true, decisionHistory: false, entryRoute: true }, null).consent.entryRoute).toBe(false)
  })
})
