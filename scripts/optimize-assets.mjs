import sharp from 'sharp'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'assets', 'source')
const target = join(root, 'public', 'art')
await mkdir(target, { recursive: true })
let total = 0
for (const name of (await readdir(source)).filter(name => name.endsWith('.png'))) {
  const output = join(target, name.replace('.png', '.webp'))
  const small = name.startsWith('queue') || name.startsWith('wrap')
  const height = name.startsWith('speaker-') ? 1024 : small ? 1000 : name.startsWith('customer') || name.startsWith('pause') ? 1400 : 941
  await sharp(join(source, name)).resize({ height, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(output)
  const bytes = (await stat(output)).size
  total += bytes
  console.log(name.replace('.png', '.webp') + ': ' + Math.round(bytes / 1024) + ' KiB')
}
console.log('Total served artwork: ' + (total / 1024 / 1024).toFixed(2) + ' MiB')
