import type { ResponseRecord } from './model'

export const collectorPath = '/api/shift-responses'
export const isLoopback = (host: string) => host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
export async function localCollectionAvailable(): Promise<boolean> {
  if (!isLoopback(window.location.hostname)) return false
  try {
    const response = await fetch(collectorPath, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(2500) })
    const result = await response.json()
    return response.ok && result.storage === 'local-pilot' && result.available === true
  } catch { return false }
}
export async function saveLocalResponse(record: ResponseRecord): Promise<string> {
  if (!isLoopback(window.location.hostname)) throw new Error('Local collection is unavailable here.')
  const response = await fetch(collectorPath, {
    method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-Counter-Pilot': '1' },
    body: JSON.stringify(record), signal: AbortSignal.timeout(8000),
  })
  const result = await response.json()
  if (!response.ok || result.saved !== true || result.responseId !== record.responseId) throw new Error('Saving was not confirmed.')
  return record.responseId
}
export function exportResponse(record: ResponseRecord) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2) + '\n'], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `the-counter-response-${record.responseId}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
