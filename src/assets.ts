/** Resolve bundled public files at either the local root or a nested deployment path. */
export function publicAsset(path: string, base = import.meta.env.BASE_URL): string {
  return base.replace(/\/?$/, '/') + path.replace(/^\/+/, '')
}

export const artwork = [
  'restaurant', 'foreground', 'customer-neutral', 'customer-watch', 'customer-concern',
  'customer-clarify', 'customer-accept', 'queue-first', 'queue-second', 'wrap',
  'pause-neutral', 'pause-phone', 'pause-explain', 'queue-third',
  'queue-middle', 'queue-far',
  'speaker-portraits',
].map(name => publicAsset('art/' + name + '.webp'))
