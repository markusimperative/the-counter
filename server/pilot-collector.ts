import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { clarityOptions, GAME_VERSION, pressureOptions, revisionOptions } from '../src/reflection/model.ts'
import type { ResponseRecord } from '../src/reflection/model.ts'

const endpoint = '/api/shift-responses'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))
const text = (value: unknown, max = 800) => typeof value === 'string' && value.length <= max
export function validResponse(value: unknown): value is ResponseRecord {
  if (!object(value) || !keys(value, ['schemaVersion', 'responseId', 'gameVersion', 'mode', 'answers', 'consent', 'decisionHistory', 'entryRoute'])) return false
  if (value.schemaVersion !== 1 || typeof value.responseId !== 'string' || !uuid.test(value.responseId) || value.gameVersion !== GAME_VERSION || !['timed', 'reflective'].includes(String(value.mode))) return false
  const a = value.answers, c = value.consent
  if (!object(a) || !keys(a, ['interpretation', 'influences', 'revision', 'revisionExplanation', 'clarity', 'clarityExplanation', 'revisit', 'timePressure'])) return false
  if (!['interpretation', 'influences', 'revisionExplanation', 'clarityExplanation', 'revisit'].every(key => text(a[key]))) return false
  if (a.revision !== null && !revisionOptions.includes(a.revision as never)) return false
  if (a.timePressure !== null && !pressureOptions.includes(a.timePressure as never)) return false
  if (!Array.isArray(a.clarity) || a.clarity.length > 6 || new Set(a.clarity).size !== a.clarity.length || !a.clarity.every(v => clarityOptions.includes(v as never))) return false
  if (a.clarity.includes(clarityOptions[4]) && a.clarity.length !== 1) return false
  if (!object(c) || !keys(c, ['answers', 'decisionHistory', 'entryRoute']) || c.answers !== true || typeof c.decisionHistory !== 'boolean' || typeof c.entryRoute !== 'boolean') return false
  if (c.decisionHistory) {
    if (!Array.isArray(value.decisionHistory) || value.decisionHistory.length !== 3) return false
    const scenes = ['morrow-lunch-rush', 'morrow-the-pause', 'morrow-the-correction']
    const consequences = [['proceed','clarify','alternative','unanswered-lunch'], ['keep-open','refund','kitchen-hold','unanswered-pause'], ['explain-confirm','correct-now','handover-context','unanswered-correction']]
    if (!value.decisionHistory.every((h, index) => {
      if (!object(h) || !keys(h, ['sceneId','choiceId','consequence','mode','elapsedMs','cueIds','storyTimeMinutes','storyTimeSeconds'])) return false
      const choice = ['A','B','C','NO_RESPONSE'].indexOf(String(h.choiceId))
      return h.sceneId === scenes[index] && choice >= 0 && h.consequence === consequences[index][choice] && h.mode === value.mode &&
        (value.mode === 'reflective' ? h.elapsedMs === null && choice !== 3 : typeof h.elapsedMs === 'number' && Number.isFinite(h.elapsedMs) && h.elapsedMs >= 0 && h.elapsedMs <= [35000,25000,30000][index]) &&
        Array.isArray(h.cueIds) && h.cueIds.length <= 2 && h.cueIds.every(v => text(v, 100)) &&
        typeof h.storyTimeMinutes === 'number' && Number.isInteger(h.storyTimeMinutes) && h.storyTimeMinutes >= 763 && h.storyTimeMinutes <= 780 &&
        typeof h.storyTimeSeconds === 'number' && Number.isInteger(h.storyTimeSeconds) && h.storyTimeSeconds >= 0 && h.storyTimeSeconds < 60
    })) return false
  } else if ('decisionHistory' in value) return false
  if (c.entryRoute) {
    if (!object(value.entryRoute) || !keys(value.entryRoute, ['value','source']) || value.entryRoute.value !== 'unprimed-pilot' || value.entryRoute.source !== 'entry-link') return false
  } else if ('entryRoute' in value) return false
  return true
}
export class DuplicateConflict extends Error {}
/** An exclusive per-response lock guards atomic publication and identical retries.
 * A stale lock fails closed; no existing response is overwritten. */
export async function persistResponse(folder: string, record: ResponseRecord) {
  if (!validResponse(record)) throw new Error('Invalid consented response')
  await mkdir(folder, { recursive: true })
  const filename = join(folder, record.responseId + '.json')
  const serialized = JSON.stringify(record)
  const temporary = join(folder, record.responseId + '.' + randomUUID() + '.tmp')
  const lockPath = join(folder, record.responseId + '.lock')
  let lock
  for (let attempt = 0; attempt < 160; attempt++) {
    try { lock = await open(lockPath, 'wx', 0o600); break }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
  if (!lock) throw new Error('Response is still being saved')
  let handle
  try {
    try {
      const stored = JSON.parse(await readFile(filename, 'utf8'))
      if (JSON.stringify(stored) !== serialized) throw new DuplicateConflict('Response reference already belongs to different content')
      return record.responseId
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(serialized + '\n', 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, filename)
    const stored = JSON.parse(await readFile(filename, 'utf8'))
    if (JSON.stringify(stored) !== serialized) throw new DuplicateConflict('Response reference already belongs to different content')
    return record.responseId
  } finally {
    await handle?.close()
    await unlink(temporary).catch(() => undefined)
    await lock.close()
    await unlink(lockPath)
  }
}
const reply = (res: ServerResponse, status: number, data: object) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(data))
}
export function pilotMiddleware(folder: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    let path = req.url?.split('?')[0] ?? ''
    try { path = decodeURIComponent(decodeURIComponent(path)).replaceAll('\\', '/').toLowerCase() } catch { return reply(res, 400, { error: 'Invalid path' }) }
    // Never expose saved records through Vite's project-root or /@fs file serving.
    if (path.includes('/pilot-responses/') || path.endsWith('/pilot-responses')) return reply(res, 404, { error: 'Not found' })
    if (path !== endpoint) return next()
    const host = req.headers.host ?? ''
    const origin = req.headers.origin
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') || (origin && origin !== 'http://' + host) || req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403, { error: 'Local pilot only' })
    if (req.method === 'GET') return reply(res, 200, { available: true, storage: 'local-pilot' })
    if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' })
    if (origin !== 'http://' + host || req.headers['x-counter-pilot'] !== '1' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return reply(res, 403, { error: 'Same-origin consented JSON required' })
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 24_000) return reply(res, 413, { error: 'Response too large' })
        chunks.push(Buffer.from(chunk))
      }
      const record: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!validResponse(record)) return reply(res, 400, { error: 'Invalid response or consent' })
      const responseId = await persistResponse(folder, record)
      return reply(res, 200, { saved: true, responseId })
    } catch (error) {
      if (error instanceof SyntaxError) return reply(res, 400, { error: 'Invalid JSON' })
      return reply(res, error instanceof DuplicateConflict ? 409 : 503, { error: 'Save not confirmed; retain answers and retry the same reference' })
    }
  }
}
export function localPilotCollector(): Plugin {
  let folder = ''
  return {
    name: 'counter-local-pilot-collector',
    configResolved(config) { folder = join(config.root, 'pilot-responses') },
    configureServer(server) { server.middlewares.use(pilotMiddleware(folder)) },
    configurePreviewServer(server) { server.middlewares.use(pilotMiddleware(folder)) },
  }
}
