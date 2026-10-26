import { afterEach, describe, expect, it, vi } from 'vitest'
import { Soundscape } from './Soundscape'

/** Small audio graph double: test lifecycle races without a sound device or real timers. */
function audioFixture() {
  const sources: { buffer?: { label?: string }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const labels = new WeakMap<ArrayBuffer, string>()
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
  const node = () => ({ connect: (target: unknown) => target, disconnect: vi.fn(), gain: parameter(), frequency: parameter(), Q: parameter(), start: vi.fn(), stop: vi.fn(), onended: null })
  class AudioGraph {
    sampleRate = 1000
    currentTime = 0
    state = 'running'
    destination = {}
    createGain = node
    createBiquadFilter = node
    createOscillator = node
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
    createBufferSource() { const source = { ...node(), buffer: undefined as { label?: string } | undefined }; sources.push(source); return source }
    async decodeAudioData(bytes: ArrayBuffer) { return { label: labels.get(bytes) } }
    async resume() { this.state = 'running' }
    async close() { this.state = 'closed' }
  }
  let release: (() => void) | undefined
  let delayed = false
  const response = (file: string) => ({ ok: true, arrayBuffer: async () => { const bytes = new ArrayBuffer(1); labels.set(bytes, file); return bytes } })
  vi.stubGlobal('AudioContext', AudioGraph)
  vi.stubGlobal('window', { AudioContext: AudioGraph })
  vi.stubGlobal('fetch', vi.fn((file: string) => file.endsWith('/speech.wav') && delayed
    ? new Promise(resolve => { release = () => resolve(response(file)) })
    : Promise.resolve(response(file))))
  return {
    sound: new Soundscape(), sources,
    delay: () => { delayed = true }, release: () => release?.(),
    voices: () => sources.filter(source => source.buffer?.label?.endsWith('/speech.wav')),
  }
}
afterEach(() => vi.unstubAllGlobals())

describe('speech cancellation at Review, mute and Replay/Exit boundaries', () => {
  it('stops current speech immediately when Review cancels dialogue', async () => {
    const f = audioFixture()
    await f.sound.start(false)
    await f.sound.speak('/audio/speech.wav')
    expect(f.voices()).toHaveLength(1)
    expect(f.voices()[0].start).toHaveBeenCalledOnce()
    f.sound.stopDialogue()
    expect(f.voices()[0].stop).toHaveBeenCalledOnce()
    f.sound.stop()
  })
  it('does not resurrect a still-loading line after Review opens', async () => {
    const f = audioFixture()
    await f.sound.start(false)
    f.delay()
    const speech = f.sound.speak('/audio/speech.wav')
    f.sound.stopDialogue()
    f.release()
    await speech
    expect(f.voices()).toHaveLength(0)
    f.sound.stop()
  })
  it('does not replay a cancelled loading line when unmuted', async () => {
    const f = audioFixture()
    await f.sound.start(false)
    f.delay()
    const speech = f.sound.speak('/audio/speech.wav')
    f.sound.setMuted(true)
    f.sound.setMuted(false)
    f.release()
    await speech
    expect(f.voices()).toHaveLength(0)
    f.sound.stop()
  })
  it('rejects a pending voice from the old audio context after a fresh shift', async () => {
    const f = audioFixture()
    await f.sound.start(false)
    f.delay()
    const speech = f.sound.speak('/audio/speech.wav')
    f.sound.stop()
    await f.sound.start(false)
    f.release()
    await speech
    expect(f.voices()).toHaveLength(0)
    f.sound.stop()
  })
})
