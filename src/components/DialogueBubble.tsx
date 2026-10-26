import type { BeatDefinition } from '../narrative/types'
import { publicAsset } from '../assets'

const staff = {
  You: { name: 'You', detail: 'Behind the counter', portrait: 'player' },
  Kitchen: { name: 'Kitchen', detail: 'Offscreen', portrait: 'kitchen' },
  Manager: { name: 'Manager', detail: 'Offscreen', portrait: 'manager' },
  Colleague: { name: 'Your colleague', detail: 'Offscreen', portrait: 'colleague' },
} as const

/** One speaker, one portrait and one consistent tint. Narrative state remains elsewhere. */
export function DialogueBubble({ beat, chapter, pendingQuestion }: {
  beat: BeatDefinition
  chapter: 1 | 2 | 3
  pendingQuestion?: string
}) {
  if (beat.speaker === 'Scene') return <div className="scene-caption">
    <span className="speaker-label">AT MORROW</span>
    <p className="dialogue-line" aria-live="polite" aria-atomic="true">{beat.line}</p>
  </div>
  const customer = beat.speaker === 'Customer'
  const identity = beat.speaker === 'Customer' ? { name: 'Customer', detail: chapter === 3 ? 'The same customer' : 'Across the counter', portrait: chapter === 1 ? 'customer-first' : 'customer-second' } : staff[beat.speaker]
  return <>
    <div className={'speech-bubble bubble-' + identity.portrait}>
      <span className={'speaker-portrait portrait-' + identity.portrait} aria-hidden="true">
        {customer && <img src={publicAsset(chapter === 1 ? 'art/customer-neutral.webp' : 'art/pause-neutral.webp')} alt="" draggable="false" />}
      </span>
      <div className="bubble-identity"><strong>{identity.name}</strong><span>{identity.detail}</span></div>
      <p className="bubble-utterance" aria-live="polite" aria-atomic="true" tabIndex={0}>
        <span className="bubble-sr-only">{identity.name}, {identity.detail}. </span>“{beat.line}”
      </p>
    </div>
    {pendingQuestion && <p className="pending-question"><span>Customer’s question</span> “{pendingQuestion}”</p>}
  </>
}
