import type { NarrativeState } from '../narrative/types'
import { activeTemporalCue } from '../narrative/decisionContent'

export function ResponseWindow({ state, reviewing = false }: { state: NarrativeState; reviewing?: boolean }) {
  const d = state.decision
  const cue = activeTemporalCue(state)
  const seconds = Math.max(0, Math.ceil(((d?.durationMs ?? 0) - (d?.elapsedMs ?? 0)) / 1000))
  return <div className="response-window" aria-live="off">
    {state.mode === 'timed' ? <>
      <div role="timer" aria-live="off" aria-label={`${seconds} seconds until the situation changes`}><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong><span>until a change</span></div>
      <progress max={d?.durationMs ?? 1} value={Math.max(0, (d?.durationMs ?? 0) - (d?.elapsedMs ?? 0))} aria-label="Remaining active response window" />
      {reviewing && <p>Time continues during Review.</p>}
      {reviewing && cue && <p className="review-temporal-cue" role="status">{cue.speaker === 'Scene' ? '' : cue.speaker + ': '}{cue.line}</p>}
    </> : <span>Reflective · no response deadline</span>}
  </div>
}
