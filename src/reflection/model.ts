import type { DecisionRecord, NarrativeState, PlayMode } from '../narrative/types.ts'

export const GAME_VERSION = '0.6.0'
export const clarityOptions = ['The people or their requests', 'The orders and their consequences', 'The passage of time', 'The controls or presentation', 'Nothing was difficult to follow', 'Something else'] as const
export const revisionOptions = ['Yes', 'No', 'Not sure'] as const
export const pressureOptions = ['Not at all', 'A little', 'Moderately', 'A lot', 'Not sure', 'I played without a response deadline'] as const
export const questions = [
  'What do you think happened during your shift?',
  'What most influenced the decisions you made?',
  'Did anything later change how you understood an earlier moment?',
  'Was anything difficult to follow?',
  'What, if anything, would you want to revisit?',
  'How much did time affect your decisions?',
] as const
export interface Answers {
  interpretation: string
  influences: string
  revision: typeof revisionOptions[number] | null
  revisionExplanation: string
  clarity: (typeof clarityOptions[number])[]
  clarityExplanation: string
  revisit: string
  timePressure: typeof pressureOptions[number] | null
}
export const emptyAnswers = (): Answers => ({ interpretation: '', influences: '', revision: null, revisionExplanation: '', clarity: [], clarityExplanation: '', revisit: '', timePressure: null })
export interface ReflectionState { page: 'invitation' | 'question' | 'consent'; index: number; answers: Answers }
export const newReflection = (): ReflectionState => ({ page: 'invitation', index: 0, answers: emptyAnswers() })
type AnswerEvent = { [K in keyof Answers]: { type: 'ANSWER'; key: K; value: Answers[K] } }[keyof Answers]
export type ReflectionEvent = AnswerEvent | { type: 'OPEN' | 'NEXT' | 'BACK' | 'SKIP' | 'CLOSE' | 'RESET' }
export function reflectionReducer(state: ReflectionState, event: ReflectionEvent): ReflectionState {
  if (event.type === 'RESET') return newReflection()
  if (event.type === 'OPEN') return { ...state, page: 'question' }
  if (event.type === 'CLOSE') return { ...state, page: 'invitation' }
  if (event.type === 'ANSWER') return { ...state, answers: { ...state.answers, [event.key]: event.value } }
  if (event.type === 'BACK') return state.page === 'consent' ? { ...state, page: 'question', index: 5 } : state.index > 0 ? { ...state, index: state.index - 1 } : { ...state, page: 'invitation' }
  if (event.type === 'NEXT' || event.type === 'SKIP') {
    // Neither navigation action discards an edited answer. Empty answers stay empty.
    return { ...state, ...(state.index === 5 ? { page: 'consent' as const } : { index: state.index + 1 }) }
  }
  return state
}
export function toggleClarity(current: Answers['clarity'], option: Answers['clarity'][number]): Answers['clarity'] {
  if (current.includes(option)) return current.filter(value => value !== option)
  if (option === clarityOptions[4]) return [option]
  return [...current.filter(value => value !== clarityOptions[4]), option]
}
export const hasInvitation = (state: NarrativeState) => state.phase === 'ending' && state.chapter === 3 && state.decisionHistory.length === 3
// This describes the entry link, not proof of someone's prior exposure.
export function knownEntry(search: string): 'unprimed-pilot' | null {
  return new URLSearchParams(search).get('entry') === 'unprimed-pilot' ? 'unprimed-pilot' : null
}
export interface ResponseRecord {
  schemaVersion: 1
  responseId: string
  gameVersion: typeof GAME_VERSION
  mode: PlayMode
  answers: Answers
  consent: { answers: true; decisionHistory: boolean; entryRoute: boolean }
  decisionHistory?: DecisionRecord[]
  entryRoute?: { value: 'unprimed-pilot'; source: 'entry-link' }
}
export function responseRecord(id: string, state: NarrativeState, answers: Answers, consent: { answers: boolean; decisionHistory: boolean; entryRoute: boolean }, entry: ReturnType<typeof knownEntry>): ResponseRecord {
  if (!consent.answers || !hasInvitation(state)) throw new Error('A completed shift and explicit response consent are required.')
  return {
    schemaVersion: 1, responseId: id, gameVersion: GAME_VERSION, mode: state.mode,
    answers: structuredClone(answers),
    consent: { answers: true, decisionHistory: consent.decisionHistory, entryRoute: Boolean(entry && consent.entryRoute) },
    ...(consent.decisionHistory ? { decisionHistory: structuredClone(state.decisionHistory) } : {}),
    ...(entry && consent.entryRoute ? { entryRoute: { value: entry, source: 'entry-link' as const } } : {}),
  }
}
