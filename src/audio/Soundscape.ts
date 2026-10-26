import type { SoundCue } from '../narrative/types'
import { publicAsset } from '../assets'

/** Local audio. A context is created only from a Begin/Replay gesture. */
export class Soundscape {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: GainNode | null = null
  private dialogue: AudioBufferSourceNode | null = null
  private dialogueToken = 0
  private muted = false
  private sources = new Set<AudioScheduledSourceNode>()
  private buffers = new Map<string, AudioBuffer>()
  private epoch = 0

  start(muted: boolean): Promise<boolean> {
    this.stop()
    const epoch = this.epoch
    try {
      if (!window.AudioContext) return Promise.resolve(false)
      const context = new AudioContext()
      this.context = context
      this.master = context.createGain()
      this.master.gain.value = muted ? 0 : 0.65
      this.master.connect(context.destination)
      this.muted = muted
      this.ambient = context.createGain()
      this.ambient.connect(this.master)
      this.ambience(context)
      void this.load('murmur.wav', context).then(buffer => {
        if (epoch !== this.epoch || this.context !== context) return
        const voice = context.createBufferSource()
        voice.buffer = buffer
        voice.loop = true
        voice.playbackRate.value = 0.94
        const filter = context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 540
        const level = context.createGain()
        level.gain.value = 0.065
        voice.connect(filter).connect(level).connect(this.ambient!)
        this.track(voice)
        voice.start()
      }).catch(() => undefined)
      return context.resume().then(() => this.context === context).catch(() => { if (this.context === context) this.stop(); return false })
    } catch {
      this.stop()
      return Promise.resolve(false)
    }
  }

  private track<T extends AudioScheduledSourceNode>(node: T): T {
    this.sources.add(node)
    node.onended = () => { this.sources.delete(node); node.disconnect() }
    return node
  }

  private noise(context: AudioContext, seconds: number) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate)
    const channel = buffer.getChannelData(0)
    let seed = 41743
    for (let i = 0; i < channel.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      channel[i] = (seed / 4294967296) * 2 - 1
    }
    return buffer
  }

  private ambience(context: AudioContext) {
    if (!this.master) return
    for (const frequency of [60, 120, 181]) {
      const oscillator = this.track(context.createOscillator())
      const gain = context.createGain()
      gain.gain.value = frequency === 60 ? 0.029 : 0.009
      oscillator.frequency.value = frequency
      oscillator.connect(gain).connect(this.ambient!)
      oscillator.start()
    }
    const fan = this.track(context.createBufferSource())
    fan.buffer = this.noise(context, 4)
    fan.loop = true
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 850
    const level = context.createGain()
    level.gain.value = 0.055
    fan.connect(lowpass).connect(level).connect(this.ambient!)
    fan.start()
    for (const offset of [1.3, 2.05, 2.8, 3.55, 4.3]) this.rustle(0.12, 0.13, 160, offset)
    this.rustle(0.35, 0.035, 1900, 0.3)
  }

  private async load(file: string, context: AudioContext) {
    const cached = this.buffers.get(file)
    if (cached) return cached
    const response = await fetch(publicAsset(`audio/${file}`))
    if (!response.ok) throw new Error('Local sound unavailable')
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    this.buffers.set(file, buffer)
    return buffer
  }

  private rustle(seconds: number, volume: number, frequency: number, offset = 0) {
    const context = this.context
    if (!context || !this.master) return
    const source = this.track(context.createBufferSource())
    source.buffer = this.noise(context, seconds)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = 0.7
    const envelope = context.createGain()
    const when = context.currentTime + offset
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(volume, when + 0.015)
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + seconds)
    source.connect(filter).connect(envelope).connect(this.ambient!)
    source.start(when)
    source.stop(when + seconds)
  }

  private tone(frequency: number, seconds: number, volume: number, offset = 0) {
    const context = this.context
    if (!context || !this.master) return
    const oscillator = this.track(context.createOscillator())
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    const envelope = context.createGain()
    const when = context.currentTime + offset
    envelope.gain.setValueAtTime(volume, when)
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + seconds)
    oscillator.connect(envelope).connect(this.ambient!)
    oscillator.start(when)
    oscillator.stop(when + seconds)
  }

  play(cue: SoundCue) {
    const context = this.context
    const epoch = this.epoch
    if (!context || !this.master) return
    if (cue === 'footsteps') {
      for (const offset of [0, 0.38, 0.76]) this.rustle(0.12, 0.08, 160, offset)
    } else if (cue === 'phone') {
      this.rustle(0.15, 0.06, 180)
      this.rustle(0.15, 0.06, 180, 0.23)
    } else if (cue === 'order-call') {
      void this.load('order-call.wav', context).then(buffer => {
        if (epoch !== this.epoch || this.context !== context || !this.master) return
        const source = this.track(context.createBufferSource())
        const filter = context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 2400
        const level = context.createGain()
        level.gain.value = 0.32
        source.buffer = buffer
        source.connect(filter).connect(level).connect(this.master)
        source.start()
      }).catch(() => undefined)
    } else if (cue === 'printer') {
      for (let i = 0; i < 8; i++) this.rustle(0.065, 0.07, 2400, i * 0.105)
      this.rustle(0.2, 0.08, 1000, 0.88)
    } else if (cue === 'paper') {
      this.rustle(0.48, 0.13, 1700)
      this.rustle(0.32, 0.065, 2600, 0.28)
    } else if (cue === 'bell') {
      this.tone(1080, 0.5, 0.032)
      this.tone(1620, 0.7, 0.012)
    }
  }

  select() { this.tone(460, 0.07, 0.025) }
  async speak(src: string, distant = false): Promise<void> {
    this.stopDialogue()
    const token = this.dialogueToken
    const context = this.context
    const epoch = this.epoch
    if (!context || !this.master || this.muted) return
    try {
      const buffer = await this.load(src.replace('/audio/', ''), context)
      if (token !== this.dialogueToken || epoch !== this.epoch || context !== this.context || this.muted || !this.master) return
      const source = this.track(context.createBufferSource())
      source.buffer = buffer
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = distant ? 3200 : 12000
      const level = context.createGain()
      level.gain.value = distant ? 0.65 : 0.95
      source.connect(filter).connect(level).connect(this.master)
      this.dialogue = source
      this.ambient?.gain.setTargetAtTime(0.45, context.currentTime, 0.15)
      source.onended = () => {
        this.sources.delete(source)
        source.disconnect()
        if (this.dialogue !== source) return
        this.dialogue = null
        this.ambient?.gain.setTargetAtTime(1, context.currentTime, 0.25)
      }
      source.start()
    } catch { /* Captions and Continue stay available when a clip cannot play. */ }
  }
  stopDialogue() {
    this.dialogueToken++
    if (this.dialogue) {
      try { this.dialogue.stop() } catch { /* Already ended. */ }
      this.dialogue = null
    }
    if (this.context && this.ambient) this.ambient.gain.setTargetAtTime(1, this.context.currentTime, 0.12)
  }
  setMuted(muted: boolean) {
    this.muted = muted
    if (muted) this.stopDialogue()
    if (this.context && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.65, this.context.currentTime, 0.04)
  }
  suspend() { if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined) }
  resume() { if (this.context?.state === 'suspended') void this.context.resume().catch(() => undefined) }

  stop() {
    this.stopDialogue()
    this.epoch++
    for (const source of this.sources) {
      try { source.stop(); source.disconnect() } catch { /* A short cue may already have ended. */ }
    }
    this.sources.clear()
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined)
    this.context = null
    this.master = null
    this.ambient = null
  }
}
