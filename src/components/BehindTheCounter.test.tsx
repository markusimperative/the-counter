import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BehindTheCounter } from './BehindTheCounter'
import { AfterShift } from './AfterShift'
import { ReadingCompanions } from './ReadingCompanions'
import { playEnding } from '../reflection/testFixtures'

describe('Behind The Counter', () => {
  it('offers the exact discovery copy and a safely named public source link', () => {
    const html = renderToStaticMarkup(<BehindTheCounter />)
    expect(html).toContain('aria-labelledby="source-discovery-title"')
    expect(html).toContain('Behind The Counter</h3>')
    expect(html).toContain('You&#x27;ve experienced the decisions. Now explore the system that made them possible.')
    expect(html).toContain('href="https://github.com/markusimperative/the-counter"')
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('aria-label="Explore the source on GitHub (opens in a new tab)"')
    expect(html).toContain('Explore the source on GitHub <span aria-hidden="true">↗</span>')
  })

  it('does not expose source discovery through either article presentation', () => {
    for (const variant of ['opening', 'ending'] as const) {
      const html = renderToStaticMarkup(<ReadingCompanions variant={variant} />)
      expect(html).not.toContain('github.com')
      expect(html).not.toContain('Behind The Counter')
      expect(html).toContain('https://notes.markmathew.com/p/between-state-and-condition')
    }
  })

  it('keeps the concluded narrative invitation free of source discovery in both launch modes', () => {
    vi.stubGlobal('window', { location: { search: '' } })
    try {
      for (const launchMode of ['public', 'pilot'] as const) {
        const html = renderToStaticMarkup(<AfterShift narrative={playEnding(['A', 'B', 'C'])} launchMode={launchMode} onReplay={() => {}} onLeave={() => {}} />)
        expect(html).toContain('Your shift is over.')
        expect(html).not.toContain('github.com')
        expect(html).not.toContain('Behind The Counter')
        expect(html).not.toContain('Continue exploring')
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
