import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyAnswers, responseRecord } from './model'
import { playEnding } from './testFixtures'
import { localCollectionAvailable, saveLocalResponse } from './transport'

afterEach(() => vi.unstubAllGlobals())
const record = () => responseRecord('52dc1e0c-66af-4fc7-a37a-b95843377a30', playEnding(), emptyAnswers(), { answers: true, decisionHistory: false, entryRoute: false }, null)
describe('local collection transport', () => {
  it('never attempts public collection and falls back when local collection is unavailable', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('window', { location: { hostname: 'example.com' } })
    expect(await localCollectionAvailable()).toBe(false)
    await expect(saveLocalResponse(record())).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    vi.stubGlobal('window', { location: { hostname: '127.0.0.1' } })
    fetcher.mockRejectedValue(new Error('Offline'))
    expect(await localCollectionAvailable()).toBe(false)
  })
  it('requires a matching persistence acknowledgement and leaves the retry payload unchanged', async () => {
    const payload = record(), before = structuredClone(payload)
    vi.stubGlobal('window', { location: { hostname: '127.0.0.1' } })
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Storage unavailable' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ saved: true, responseId: payload.responseId }) })
    vi.stubGlobal('fetch', fetcher)
    await expect(saveLocalResponse(payload)).rejects.toThrow()
    expect(payload).toEqual(before)
    expect(await saveLocalResponse(payload)).toBe(payload.responseId)
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body)
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ saved: true, responseId: 'different-reference' }) })
    await expect(saveLocalResponse(payload)).rejects.toThrow()
  })
})
