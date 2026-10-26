import type { NarrativeState } from '../narrative/types'

export type LaunchMode = 'public' | 'pilot'
export type SurveyResolution = 'completed' | 'skipped' | 'declined'
export interface ReadingCompanion {
  order: 1 | 2 | 3
  part: 'I' | 'II' | 'III'
  title: string
  teaser: string
  publication: { state: 'published'; verifiedPublicUrl: `https://${string}` } | { state: 'coming-soon'; verifiedPublicUrl: null }
  image?: { src: string; alt: string }
}

// Public destinations verified against published/everyone metadata and the live pages, 2026-10-25.
// Part III's public destination was verified on 2026-10-26. Never use an editor URL.
export const readingCompanions: readonly ReadingCompanion[] = [
  { order: 1, part: 'I', title: 'Respect Is Coherence', teaser: 'An exploration of respect as coherence between state, condition and conduct.', publication: { state: 'published', verifiedPublicUrl: 'https://markmathew.substack.com/p/respect-is-coherence' } },
  { order: 2, part: 'II', title: 'Where Respect Becomes Visible', teaser: 'How that coherence becomes observable through ordinary interactions.', publication: { state: 'published', verifiedPublicUrl: 'https://markmathew.substack.com/p/where-respect-becomes-visible' } },
  { order: 3, part: 'III', title: 'Between State and Condition', teaser: 'An invitation to explore the idea through The Counter.', publication: { state: 'published', verifiedPublicUrl: 'https://notes.markmathew.com/p/between-state-and-condition' } },
]

// A flow preference, separate from Timed/Reflective. Retain the old pilot link's unprimed behavior.
export function launchModeFromSearch(search: string): LaunchMode {
  const params = new URLSearchParams(search)
  return params.get('mode') === 'pilot' || params.get('entry') === 'unprimed-pilot' ? 'pilot' : 'public'
}

export function companionsVisible(mode: LaunchMode, phase: NarrativeState['phase'], survey: SurveyResolution | null = null): boolean {
  return phase === 'title' ? mode === 'public' : phase === 'ending' && survey !== null
}
