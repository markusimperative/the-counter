// Developer QA only. Connects to a separate, locally launched Chrome on port 9236.
// No dependency, app import, injected visibility property or gameplay clock override.
import { writeFile } from 'node:fs/promises'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const endpoint = `http://127.0.0.1:${Number(process.argv[2] ?? 9236)}`
let target
for (let i = 0; i < 200; i++) {
  try {
    const targets = await (await fetch(endpoint + '/json')).json()
    target = targets.find(t => t.type === 'page' && t.url.startsWith('http://127.0.0.1:5173/'))
    if (target) break
    if (i === 0) await fetch(endpoint + '/json/new?http://127.0.0.1:5173/', { method: 'PUT' })
  } catch { /* The separate QA process may still be starting. */ }
  await sleep(100)
}
if (!target) throw new Error('Owned QA browser page unavailable')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  const waiting = pending.get(message.id)
  if (waiting) { pending.delete(message.id); if (message.error) waiting.reject(message.error); else waiting.resolve(message.result) }
})
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
}
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (exceptionDetails) throw new Error(exceptionDetails.text)
  return result.value
}
async function until(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100) }
  throw new Error('QA condition did not become true: ' + expression)
}
const click = name => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(name)}))?.click()`)
const snapshot = () => evaluate(`({ hidden:document.hidden, visibility:document.visibilityState, phase:document.querySelector('main').dataset.phase, clock:document.querySelector('.scene-footer')?.textContent, window:document.querySelector('.response-window')?.textContent, events:window.__lifecycle })`)
const report = {}
try {
  await send('Page.enable')
  await until(`document.readyState==='complete' && !!document.querySelector('main')`)
  await evaluate(`window.__lifecycle=[];document.addEventListener('visibilitychange',()=>window.__lifecycle.push(document.visibilityState));document.addEventListener('freeze',()=>window.__lifecycle.push('freeze'));document.addEventListener('resume',()=>window.__lifecycle.push('resume'))`)
  const win = await send('Browser.getWindowForTarget')
  await send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'minimized' } })
  await sleep(300)
  report.nativeHidden = await evaluate('document.hidden')
  if (!report.nativeHidden) throw new Error('Native Chrome did not enter hidden state; no suspension claim can be made')
  await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Begin shift')&&!b.disabled)`)
  await click('Begin shift')
  await until(`document.querySelector('main').dataset.phase==='encounter'`)
  await click('Continue'); await click('Open responses')
  report.before = await snapshot()
  await sleep(37_000)
  report.after37SecondsHidden = await snapshot()
  await send('Page.setWebLifecycleState', { state: 'frozen' })
  await sleep(1500)
  await send('Page.setWebLifecycleState', { state: 'active' })
  await send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'normal' } })
  await send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { left: 100, top: 100, width: 900, height: 700 } })
  await send('Page.bringToFront')
  await until('!document.hidden')
  await sleep(1600)
  report.resumed = await snapshot()
  await send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'minimized' } })
  await until('document.hidden')
  report.beforeSecondPause = await snapshot()
  await sleep(2000)
  report.afterSecondPause = await snapshot()
  report.passed = report.before.phase === 'decision' && report.after37SecondsHidden.phase === 'decision' && report.before.clock === report.after37SecondsHidden.clock && report.resumed.phase === 'decision' && report.resumed.clock !== report.before.clock && report.beforeSecondPause.clock === report.afterSecondPause.clock && report.resumed.events.includes('freeze') && report.resumed.events.includes('resume')
} catch (error) { report.error = String(error); report.passed = false }
finally {
  await writeFile(new URL('../docs/visibility-verification.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  await send('Browser.close').catch(() => undefined)
  socket.close()
}
if (!report.passed) process.exitCode = 1
