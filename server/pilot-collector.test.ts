import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { emptyAnswers, responseRecord } from '../src/reflection/model.ts'
import { playEnding } from '../src/reflection/testFixtures.ts'
import { DuplicateConflict, persistResponse, pilotMiddleware, validResponse } from './pilot-collector.ts'

const id = '52dc1e0c-66af-4fc7-a37a-b95843377a30'
const record = () => responseRecord(id, playEnding(), { ...emptyAnswers(), interpretation: 'QA fixture only.' }, { answers: true, decisionHistory: true, entryRoute: false }, null)
const folders: string[] = []
const testRoot = resolve('docs/verification-tmp')
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => {
  if (dirname(resolve(folder)) !== testRoot) throw new Error('Unsafe test cleanup target')
  return rm(folder, { recursive: true, force: true })
})) })
async function folder() { await mkdir(testRoot, { recursive: true }); const path = await mkdtemp(join(testRoot, 'counter-pilot-test-')); folders.push(path); return path }
async function request(storage: string, method: string, path: string, value?: unknown, origin = 'http://127.0.0.1:5173') {
  const req = Object.assign(Readable.from(value === undefined ? [] : [Buffer.from(JSON.stringify(value))]), {
    method, url: path, headers: { host: '127.0.0.1:5173', origin, 'content-type': 'application/json', 'x-counter-pilot': '1' }, socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage
  let status = 0, data: Record<string, unknown> = {}
  const res = { writeHead(code: number) { status = code }, end(body: string) { data = JSON.parse(body) } } as unknown as ServerResponse
  await pilotMiddleware(storage)(req, res, () => { status = 404 })
  return { status, data }
}

describe('local pilot persistence', () => {
  it('validates consent, sizes and the allowlisted schema', () => {
    expect(validResponse(record())).toBe(true)
    expect(validResponse({ ...record(), email: 'not accepted' })).toBe(false)
    expect(validResponse({ ...record(), responseId: '../escape' })).toBe(false)
    expect(validResponse({ ...record(), consent: { answers: false, decisionHistory: true, entryRoute: false } })).toBe(false)
    expect(validResponse({ ...record(), consent: { answers: true, decisionHistory: false, entryRoute: false } })).toBe(false)
    expect(validResponse({ ...record(), answers: { ...emptyAnswers(), interpretation: 'x'.repeat(801) } })).toBe(false)
  })
  it('saves the exact consented payload, reads it back, and handles concurrent retries once', async () => {
    const path = await folder(), response = record()
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => persistResponse(path, response)))
    expect(attempts.every(result => result.status === 'fulfilled')).toBe(true)
    expect(await readdir(path)).toEqual([id + '.json'])
    expect(JSON.parse(await readFile(join(path, id + '.json'), 'utf8'))).toEqual(response)
    await expect(persistResponse(path, { ...response, answers: { ...response.answers, revisit: 'Different content' } })).rejects.toBeInstanceOf(DuplicateConflict)
    expect(JSON.parse(await readFile(join(path, id + '.json'), 'utf8'))).toEqual(response)
  })
  it('acknowledges only persisted data and refuses foreign origins or private-file reads', async () => {
    const path = await folder()
    expect((await request(path, 'POST', '/api/shift-responses', record(), 'https://example.com')).status).toBe(403)
    expect(await readdir(path)).toEqual([])
    expect((await request(path, 'GET', '/api/shift-responses')).data).toEqual({ available: true, storage: 'local-pilot' })
    const saved = await request(path, 'POST', '/api/shift-responses', record())
    expect(saved.status).toBe(200)
    expect(saved.data).toEqual({ saved: true, responseId: id })
    expect(JSON.parse(await readFile(join(path, id + '.json'), 'utf8'))).toEqual(record())
    expect((await request(path, 'POST', '/api/shift-responses', record())).status).toBe(200)
    expect(await readdir(path)).toEqual([id + '.json'])
    for (const route of ['/pilot-responses/' + id + '.json', '/@fs/C:/project/pilot-responses/' + id + '.json', '/%70ilot-responses/' + id + '.json']) expect((await request(path, 'GET', route)).status).toBe(404)
    expect((await request(path, 'POST', '/api/shift-responses', { ...record(), extra: true })).status).toBe(400)
  })
  it('returns a retriable failure rather than success when storage cannot persist', async () => {
    const root = await folder(), path = join(root, 'not-a-directory')
    await writeFile(path, 'QA storage failure fixture')
    const response = await request(path, 'POST', '/api/shift-responses', record())
    expect(response.status).toBe(503)
    expect(response.data).not.toHaveProperty('saved')
    expect(await readFile(path, 'utf8')).toBe('QA storage failure fixture')
  })
})
