import { describe, expect, it } from 'vitest'
import { publicAsset } from './assets'

describe('public asset paths', () => {
  it('keeps local files at the root during development', () => {
    expect(publicAsset('art/restaurant.webp', '/')).toBe('/art/restaurant.webp')
    expect(publicAsset('/audio/dialogue/customer-opening.wav', '/')).toBe('/audio/dialogue/customer-opening.wav')
  })
  it('keeps every dynamic path inside the deployment directory', () => {
    const base = '/experiments/the-counter/'
    expect(publicAsset('art/restaurant.webp', base)).toBe(base + 'art/restaurant.webp')
    expect(publicAsset('/audio/dialogue/customer-opening.wav', base)).toBe(base + 'audio/dialogue/customer-opening.wav')
    expect(publicAsset('art/queue-far.webp', base.slice(0, -1))).toBe(base + 'art/queue-far.webp')
    expect(publicAsset('art/wrap.webp', './')).toBe('./art/wrap.webp')
  })
})
