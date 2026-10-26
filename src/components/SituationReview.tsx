import { useEffect, useRef } from 'react'
import type { NarrativeState } from '../narrative/types'
import { currentBeat } from '../narrative/engine'
import { firstOutcomeSummary } from '../narrative/summaries'
import { inheritedSummary } from '../narrative/revision'
import { sceneForId } from '../narrative/story'
import { currentOrderFacts, pendingWork } from '../presentation/context'
import { ResponseWindow } from './ResponseWindow'

export function SituationReview({ state, onReview, muted, onToggleSound, audioAvailable }: {
  state: NarrativeState
  onReview: () => void
  muted: boolean
  onToggleSound: () => void
  audioAvailable: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  const beat = currentBeat(state)
  const active = state.phase === 'decision' && state.decision?.status === 'active'
  const c = state.correction
  return <div className="situation-review-control">
    <button type="button" className="situation-review" ref={buttonRef} aria-haspopup="dialog" aria-controls="situation-review" onClick={() => {
      onReview()
      if (!dialogRef.current?.open) dialogRef.current?.showModal()
    }}>Review situation <span aria-hidden="true">↗</span></button>
    <dialog id="situation-review" className="situation-dialog" ref={dialogRef} aria-labelledby="situation-heading" aria-describedby="situation-order" onClose={() => buttonRef.current?.isConnected && buttonRef.current.focus({ preventScroll: true })} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'))
      const target = event.shiftKey ? controls.at(-1) : controls[0]
      const boundary = event.shiftKey ? controls[0] : controls.at(-1)
      if (document.activeElement === boundary) { event.preventDefault(); target?.focus() }
    }}>
      <header><h2 id="situation-heading">Review situation</h2><button type="button" className="situation-close" aria-label="Close situation" onClick={() => dialogRef.current?.close()}>×</button></header>
      {active ? <ResponseWindow state={state} reviewing /> : <p className="review-reading-time">Take your time. {state.phase === 'decision' ? 'The window starts when you open responses.' : 'Continue advances the conversation.'}</p>}
      <div className="situation-dialog-body" tabIndex={0} aria-label="Situation details">
        <p className="situation-order" id="situation-order">{currentOrderFacts(state)}</p>
        {beat && <blockquote><span>{beat.speaker === 'Scene' ? 'AT MORROW' : beat.speaker === 'Colleague' ? 'YOUR COLLEAGUE · OFFSCREEN' : beat.speaker.toUpperCase()}</span><p>“{beat.line}”</p></blockquote>}
        {state.pauseOrder?.request && <blockquote><span>ORIGINAL REQUEST</span><p>“{state.pauseOrder.request.text}”</p></blockquote>}
        {c?.request && <blockquote><span>REVISED REQUEST · 12:49 PM</span><p>“{c.request.text}”</p></blockquote>}
        <h3>What is still needed</h3><p>{pendingWork(state)}</p>
        <h3>Register and kitchen</h3>
        <p>{state.register === 'occupied' ? 'This register is occupied by the open paid order.' : 'The register is available.'} Hot orders are currently estimated at {state.kitchen.estimateMinutes} minutes. {state.chapter >= 2 && 'A HOLD preserves a kitchen place by sending a ticket; preparation stays paused.'}</p>
        {state.chapter === 1 && <p>{state.orderStatus === 'handed-off' ? 'The customer chose the ready wrap.' : 'A chicken wrap is ready now.'} {state.customerDeadline ? 'The customer must be back at work at 12:53 PM; their travel time is unknown.' : state.phase === 'encounter' ? 'The customer’s available time has not been discussed yet.' : 'The customer has about ten minutes. Their exact return-to-work deadline has not been learned.'}</p>}
        {state.pauseOrder && <><h3>Original transaction</h3><ul>{state.pauseOrder.items.map((item, index) => <li key={index}>{item.name} · €{item.amount.toFixed(2)}</li>)}</ul><p>Original payment: €25.00. {state.pauseOrder.refund === 'complete' ? 'Fully refunded; original details retained.' : 'Paid.'} {state.pauseOrder.request?.sentDespiteRequest && 'The three-meal HOLD ticket was sent despite the request to leave it unsent.'}</p></>}
        {c && <><h3>Transaction and ticket history</h3><p>At the start of this chapter: {inheritedSummary(state)}.</p><ol>{c.ledger.map(entry => <li key={entry.id}>{entry.detail}</li>)}</ol><p>Responsibility: {c.owner === 'colleague' ? 'your colleague has accepted the remaining work' : 'you still own the work'}.</p></>}
        {state.decisionHistory.length > 0 && <><h3>Earlier decisions</h3><ol>{state.decisionHistory.map(entry => { const scene = sceneForId(entry.sceneId); return <li key={entry.sceneId}><strong>{scene.title}</strong>: {entry.choiceId === 'NO_RESPONSE' ? 'No response before the window closed.' : scene.choices.find(choice => choice.id === entry.choiceId)?.text}</li> })}</ol>{state.firstEncounter && <p>{firstOutcomeSummary(state)}</p>}</>}
      </div>
      <footer>
        <button type="button" className="situation-audio" disabled={!audioAvailable} aria-pressed={muted} onClick={onToggleSound}>{!audioAvailable ? 'Sound unavailable' : muted ? 'Unmute sound' : 'Mute sound'}</button>
        <button type="button" className="text-button" onClick={() => dialogRef.current?.close()}>{active ? 'Return to choices' : 'Return to scene'} <span aria-hidden="true">↵</span></button>
      </footer>
    </dialog>
  </div>
}
