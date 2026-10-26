import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReadingCompanions } from '../components/ReadingCompanions'
import type { Phase, ResolutionId } from '../narrative/types'
import { narrativeReducer } from '../narrative/engine'
import { emptyAnswers, newReflection, reflectionReducer } from '../reflection/model'
import { playEnding } from '../reflection/testFixtures'
import { companionsVisible, launchModeFromSearch, readingCompanions } from './companions'
import type { LaunchMode, SurveyResolution } from './companions'

describe('Reading Companions', () => {
  it('separates explicit launch flow from play mode and protects earlier pilot links', () => {
    for (const search of ['', '?mode=public', '?mode=timed', '?mode=reflective', '?mode=unknown']) expect(launchModeFromSearch(search)).toBe('public')
    for (const search of ['?mode=pilot', '?mode=pilot&play=reflective', '?entry=unprimed-pilot', '?mode=public&entry=unprimed-pilot']) expect(launchModeFromSearch(search)).toBe('pilot')
  })
  it('reveals only public title or an explicitly finished post-survey screen', () => {
    const active: Phase[] = ['opening', 'encounter', 'decision', 'consequence', 'transition']
    const resolutions: (SurveyResolution | null)[] = [null, 'completed', 'skipped', 'declined']
    for (const mode of ['public', 'pilot'] as LaunchMode[]) {
      for (const resolution of resolutions) {
        for (const phase of active) expect(companionsVisible(mode, phase, resolution)).toBe(false)
        expect(companionsVisible(mode, 'title', resolution)).toBe(mode === 'public')
        expect(companionsVisible(mode, 'ending', resolution)).toBe(resolution !== null)
      }
    }
  })
  it('keeps all survey questions and the consent screen unprimed until a final action', () => {
    let survey = reflectionReducer(newReflection(), { type: 'OPEN' })
    for (let i = 0; i < 6; i++) {
      expect(companionsVisible('pilot', 'ending', null)).toBe(false)
      survey = reflectionReducer(survey, { type: 'SKIP' })
    }
    expect(survey.page).toBe('consent')
    expect(survey.answers).toEqual(emptyAnswers())
    expect(companionsVisible('pilot', 'ending', null)).toBe(false)
  })
  it('resets discarded survey answers without changing Back/Skip behavior', () => {
    let survey = reflectionReducer(newReflection(), { type: 'OPEN' })
    survey = reflectionReducer(survey, { type: 'ANSWER', key: 'interpretation', value: 'Draft to discard' })
    survey = reflectionReducer(survey, { type: 'SKIP' })
    expect(survey.answers.interpretation).toBe('Draft to discard')
    expect(reflectionReducer(survey, { type: 'RESET' })).toEqual(newReflection())
  })
  it('keeps pilot replay and exit unprimed for every Timed history and each launch flow', () => {
    const choices: ResolutionId[] = ['A', 'B', 'C', 'NO_RESPONSE']
    for (const a of choices) for (const b of choices) for (const c of choices) {
      const ending = playEnding([a, b, c])
      expect(companionsVisible('pilot', ending.phase, null)).toBe(false)
      for (const resolution of ['completed', 'skipped', 'declined'] as const) {
        expect(companionsVisible('pilot', ending.phase, resolution)).toBe(true)
      }
      expect(companionsVisible('pilot', narrativeReducer(ending, { type: 'REPLAY' }).phase)).toBe(false)
      expect(companionsVisible('pilot', narrativeReducer(ending, { type: 'EXIT' }).phase)).toBe(false)
    }
  })
  it('keeps both variants ordered and safely links all three published previews', () => {
    expect(readingCompanions.map(article => article.order)).toEqual([1, 2, 3])
    expect(readingCompanions.map(article => article.publication)).toEqual([
      { state: 'published', verifiedPublicUrl: 'https://markmathew.substack.com/p/respect-is-coherence' },
      { state: 'published', verifiedPublicUrl: 'https://markmathew.substack.com/p/where-respect-becomes-visible' },
      { state: 'published', verifiedPublicUrl: 'https://notes.markmathew.com/p/between-state-and-condition' },
    ])
    for (const variant of ['opening', 'ending'] as const) {
      const html = renderToStaticMarkup(<ReadingCompanions variant={variant} />)
      expect((html.match(/<a /g) ?? []).length).toBe(3)
      expect((html.match(/target="_blank" rel="noopener noreferrer"/g) ?? []).length).toBe(3)
      expect((html.match(/opens in a new tab/g) ?? []).length).toBe(3)
      expect(html).not.toContain('Coming soon</span>')
      expect(html).not.toMatch(/222029893|\/publish|\/draft|<button/)
      expect(html.indexOf('Respect Is Coherence')).toBeLessThan(html.indexOf('Where Respect Becomes Visible'))
      expect(html.indexOf('Where Respect Becomes Visible')).toBeLessThan(html.indexOf('Between State and Condition'))
      for (const article of readingCompanions) if (article.publication.state === 'published') {
        expect(html).toContain(`href="${article.publication.verifiedPublicUrl}"`)
        expect(html).toContain(`aria-label="Read article: ${article.title} (opens in a new tab)"`)
      }
    }
  })
})
