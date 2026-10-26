import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'exports', 'the-counter-screenshots-2026-10-25')
await fs.mkdir(output, { recursive: true })
const sourceRoot = path.join(root, 'docs', 'screenshots')
const groups = [
  ['01-current-journey', 'Current game — complete walkthroughs', 'current-journey'],
  ['02-current-bubbles-and-mobile', 'Current game — dialogue bubbles and mobile layouts', 'dialogue-bubbles'],
  ['03-development-history/01-original-slice', 'Original vertical slice', '.'],
  ['03-development-history/02-v0.2-performance', 'v0.2 — character performance', 'v0.2'],
  ['03-development-history/03-v0.3-the-pause', 'v0.3 — The Pause', 'v0.3'],
  ['03-development-history/04-v0.3.1-environment', 'v0.3.1 — environmental storytelling', 'v0.3.1'],
  ['03-development-history/05-v0.4-the-correction', 'v0.4 — The Correction', 'v0.4'],
  ['03-development-history/06-v0.5-waiting', 'v0.5 — The Cost of Waiting', 'v0.5'],
  ['04-reverted-UI-experiment', 'Historical — reverted UI experiment', 'narrative-clarity'],
  ['05-audit-reference', 'Historical — audit captures before the reverted experiment', '../audits/2026-10-25-narrative-clarity'],
]
const images = []
const extensions = /\.(png|jpe?g|webp)$/i
const correctedNames = new Map([
  ['17-chapter-II-queue-cue.jpg', '17-chapter-II-manager-cue.jpg'],
  ['18-chapter-II-manager-cue.jpg', '18-chapter-II-intervention.jpg'],
  ['28-chapter-III-phone-cue.jpg', '28-chapter-III-colleague-cue.jpg'],
  ['29-chapter-III-colleague-cue.jpg', '29-chapter-III-unanswered.jpg'],
])
const normalise = name => correctedNames.get(name) ?? name
async function copyImages(source, relative, groupTitle, recurse) {
  for (const entry of (await fs.readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const from = path.join(source, entry.name)
    if (entry.isDirectory() && recurse) await copyImages(from, relative + '/' + entry.name, groupTitle, true)
    if (!entry.isFile() || !extensions.test(entry.name)) continue
    const toRelative = relative + '/' + (relative.includes('05-timed-no-response') ? normalise(entry.name) : entry.name)
    const target = path.join(output, toRelative)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(from, target)
    const bytes = await fs.readFile(target)
    const info = await sharp(bytes).metadata()
    if (!info.width || !info.height) throw Error('Unreadable screenshot: ' + from)
    images.push({ path: toRelative, group: groupTitle, width: info.width, height: info.height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
  }
}
for (const [destination, title, source] of groups) await copyImages(path.resolve(sourceRoot, source), destination, title, source !== '.')
const rawManifest = JSON.parse(await fs.readFile(path.join(sourceRoot, 'current-journey', 'capture-manifest.json'), 'utf8'))
const manifest = [...new Map(rawManifest.map(item => {
  const parts = item.path.split('/')
  if (parts[0] === '05-timed-no-response') parts[parts.length - 1] = normalise(parts.at(-1))
  const corrected = { ...item, path: '01-current-journey/' + parts.join('/') }
  return [corrected.path, corrected]
})).values()]
await fs.writeFile(path.join(output, 'current-journey-captions.json'), JSON.stringify(manifest, null, 2))
const captions = new Map(manifest.map(item => [item.path, item.dialogue]))
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const summary = `The Counter — screenshot collection\n\n${images.length} screenshots. Prepared 25 October 2026.\n\nExtract the ZIP, then open index.html to browse all images. Click any thumbnail to open the original full-size capture. Everything works locally with no network connection.\n\n01-current-journey: ${manifest.length} current-design desktop captures, organised in reading order. Includes title, every dialogue and decision beat in three representative complete routes (A/A/A, B/B/B, C/C/C), their consequences and endings, plus a complete unanswered Timed route. These routes cover every A/B/C choice across the three chapters; they are not a separate run of all 27 mixed choice combinations. Timed cue captures record the actual observed moment. A few screenshots show the same unanswered beat at successive moments.\n\n02-current-bubbles-and-mobile: nine current-design desktop, portrait phone, small phone and landscape captures.\n\n03-development-history: all saved screenshots from the original slice and v0.2, v0.3, v0.3.1, v0.4 and v0.5. These are historical versions.\n\n04-reverted-UI-experiment: the rejected UI changes, preserved for reference and not the current game.\n\n05-audit-reference: screenshots taken during the earlier UI/UX audit, including report captures.\n\nThe game is caption-led; these are still images, not an audio or video recording. Current routes were captured muted at 1440 x 900; the layout set includes additional sizes. Older captures keep their original resolution.\n\nmanifest.json records image dimensions, file size and SHA-256 hashes. current-journey-captions.json records visible dialogue and screen text for the fresh walkthroughs.\n\nAn interactive narrative by Mark Mathew.\n`
await fs.writeFile(path.join(output, 'START-HERE.txt'), summary)
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ prepared: '2026-10-25', count: images.length, images }, null, 2))
const sections = groups.map(([folder, title]) => {
  const items = images.filter(item => item.group === title)
  return `<section id="${escape(folder)}"><h2>${escape(title)} <small>${items.length} images</small></h2><div class="grid">${items.map(item => `<figure><a href="${escape(item.path)}"><img loading="lazy" src="${escape(item.path)}" alt="${escape(item.path)}"></a><figcaption><a href="${escape(item.path)}">${escape(item.path.split('/').slice(1).join(' / '))}</a><span>${item.width} × ${item.height}</span>${captions.get(item.path) ? `<p>${escape(captions.get(item.path))}</p>` : ''}</figcaption></figure>`).join('\n')}</div></section>`
}).join('\n')
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Counter — screenshot collection</title><style>body{margin:0;background:#111913;color:#eee9dd;font:16px/1.5 system-ui,sans-serif;padding:32px;max-width:1800px}h1{font:44px Georgia,serif;margin:0 0 12px}h2{font-size:24px;margin:40px 0 18px}h2 small{font:14px system-ui;color:#c8c6b8}p{max-width:1000px}a{color:#e4c397}nav{display:flex;flex-wrap:wrap;gap:10px 22px;max-width:1200px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:24px}figure{margin:0;background:#1b271f;padding:10px;min-width:0}img{width:100%;height:230px;object-fit:contain;background:#090d0a}figcaption{font-size:14px;overflow-wrap:anywhere}figcaption span{display:block;color:#b3bfad;font-size:12px}figcaption p{font-size:14px;margin:8px 0}footer{margin:50px 0 20px;border-top:1px solid #62715e;padding-top:20px}@media(max-width:600px){body{padding:18px}h1{font-size:34px}}</style><h1>The Counter</h1><p>${images.length} screenshots across the current player journey and the development history. Extracted images open at full resolution when clicked.</p><p><strong>Start with the current journey.</strong> Three complete routes cover every A/B/C choice across the three chapters, followed by the Timed unanswered route. Mixed permutations are not captured as separate complete runs. Historical and reverted UI captures are clearly separated below.</p><p><a href="START-HERE.txt">Collection notes</a> · <a href="manifest.json">Image manifest</a> · <a href="current-journey-captions.json">Current journey captions</a></p><nav>${groups.map(([folder,title])=>`<a href="#${escape(folder)}">${escape(title)}</a>`).join('')}</nav>${sections}<footer>An interactive narrative by Mark Mathew. Collected 25 October 2026. Local captures; no external assets or network requests.</footer></html>`)
console.log(JSON.stringify({ output, screenshots: images.length, freshJourneyScreenshots: manifest.length, bytes: images.reduce((sum, item) => sum + item.bytes, 0), groups: groups.map(([, title]) => ({ title, count: images.filter(item => item.group === title).length })) }, null, 2))
