/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lunchRush, thePause, theCorrection, scenes, authoredBeats } from '../narrative/story'
import { voiceCatalog } from './voiceCatalog'

const voicedBeats = (scene: typeof scenes[number]) => authoredBeats(scene).filter(beat => beat.performance.voiceId)
describe('saved dialogue contract', () => {
  it('matches every voiced caption exactly and uses one customer voice', () => {
    const voices = new Set<string>()
    for (const beat of voicedBeats(lunchRush)) {
      const clip = voiceCatalog[beat.performance.voiceId!]
      expect(clip?.text).toBe(beat.line)
      if (beat.speaker === 'Customer') voices.add(clip.voice)
    }
    expect([...voices]).toEqual(['af_heart'])
  })
  it('gives the second customer a distinct consistent voice and preserves exact captions', () => {
    const voices = new Set<string>()
    for (const beat of scenes.flatMap(voicedBeats)) expect(voiceCatalog[beat.performance.voiceId!]?.text).toBe(beat.line)
    for (const beat of voicedBeats(thePause)) if (beat.speaker === 'Customer') voices.add(voiceCatalog[beat.performance.voiceId!].voice)
    expect([...voices]).toEqual(['bm_george'])
    expect(new Set(voicedBeats(theCorrection).filter(beat => beat.speaker === 'Customer').map(beat => voiceCatalog[beat.performance.voiceId!].voice))).toEqual(new Set(['bm_george']))
  })
  it('bundles valid non-silent, unclipped 24kHz mono recordings', () => {
    for (const clip of Object.values(voiceCatalog)) {
      const wav = readFileSync('public' + clip.src)
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
      expect(wav.readUInt32LE(24)).toBe(24000)
      expect(wav.readUInt16LE(22)).toBe(1)
      let peak = 0
      expect(wav.readUInt16LE(20)).toBe(3) // IEEE float WAV, produced by RawAudio.save.
      expect(wav.readUInt16LE(34)).toBe(32)
      for (let offset = 44; offset + 3 < wav.length; offset += 4) peak = Math.max(peak, Math.abs(wav.readFloatLE(offset)))
      expect(peak).toBeGreaterThan(0.03)
      expect(peak).toBeLessThan(1)
      expect(clip.duration).toBeGreaterThan(1)
    }
  })
  it('presents the same shared notice and equivalent response pacing on every branch', () => {
    const notices = lunchRush.choices.map(choice => choice.beats[1])
    expect(notices[0]).toBe(notices[1])
    expect(notices[1]).toBe(notices[2])
    expect(lunchRush.choices.map(choice => choice.beats[0].performance.voiceDelayMs)).toEqual([450, 450, 450])
  })
})
