import { useEffect, useReducer, useRef, useState } from 'react'
import type { NarrativeState } from '../narrative/types'
import { clarityOptions, GAME_VERSION, knownEntry, newReflection, pressureOptions, questions, reflectionReducer, responseRecord, revisionOptions, toggleClarity } from '../reflection/model'
import type { Answers, ResponseRecord } from '../reflection/model'
import { exportResponse, localCollectionAvailable, saveLocalResponse } from '../reflection/transport'
import { companionsVisible } from '../reading/companions'
import type { LaunchMode, SurveyResolution } from '../reading/companions'
import { ReadingCompanions } from './ReadingCompanions'
import { BehindTheCounter } from './BehindTheCounter'
import './after-shift.css'

type SaveStatus = 'idle' | 'saving' | 'error' | 'saved' | 'export-requested' | 'export-confirmed'

export function AfterShift({ narrative, launchMode, onReplay, onLeave }: { narrative: NarrativeState; launchMode: LaunchMode; onReplay: () => void; onLeave: () => void }) {
  const [state, dispatch] = useReducer(reflectionReducer, undefined, newReflection)
  const [collector, setCollector] = useState<boolean | null>(null)
  const [consent, setConsent] = useState(false)
  const [historyConsent, setHistoryConsent] = useState(false)
  const [entryConsent, setEntryConsent] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [confirmLeave, setConfirmLeave] = useState<'finish' | 'replay' | null>(null)
  const [resolution, setResolution] = useState<SurveyResolution | null>(null)
  const [exportError, setExportError] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorMessage = useRef<HTMLParagraphElement>(null)
  const record = useRef<ResponseRecord | null>(null)
  const [submittedRecord, setSubmittedRecord] = useState<ResponseRecord | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  const [entry] = useState(() => knownEntry(window.location.search))
  const saved = status === 'saved' || status === 'export-confirmed'
  const finalResolution = saved ? 'completed' : resolution
  const locked = submittedRecord !== null
  const dirty = Object.values(state.answers).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value))
  useEffect(() => {
    mounted.current = true
    void localCollectionAvailable().then(available => { if (mounted.current) setCollector(available) })
    return () => { mounted.current = false }
  }, [])
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [state.page, state.index, finalResolution, confirmLeave])
  useEffect(() => { if (status === 'error') errorMessage.current?.focus() }, [status])
  const finishWithoutSubmitting = () => {
    setResolution(state.page === 'invitation' ? 'declined' : 'skipped')
    dispatch({ type: 'RESET' })
    setConfirmLeave(null)
  }
  const leave = (action: 'finish' | 'replay') => {
    if (!saved && (dirty || locked)) setConfirmLeave(action)
    else if (action === 'replay') onReplay()
    else finishWithoutSubmitting()
  }
  const submission = () => {
    if (!record.current) {
      record.current = responseRecord(crypto.randomUUID(), narrative, state.answers, { answers: consent, decisionHistory: historyConsent, entryRoute: entryConsent }, entry)
      setSubmittedRecord(record.current)
    }
    return record.current
  }
  const save = async () => {
    if (!consent || busy.current || saved) return
    busy.current = true
    setStatus('saving')
    try {
      await saveLocalResponse(submission())
      if (mounted.current) setStatus('saved')
    } catch {
      if (mounted.current) setStatus('error')
    } finally { busy.current = false }
  }
  const download = () => {
    if (!consent || busy.current || saved) return
    try { exportResponse(submission()); setExportError(false); setStatus('export-requested') }
    catch { setExportError(true) }
  }
  const textField = (key: 'interpretation' | 'influences' | 'revisit' | 'revisionExplanation' | 'clarityExplanation', explanation = false) => <div className="reflection-text-field">
    {explanation && <label htmlFor={key}>Optional explanation</label>}
    <textarea id={key} aria-labelledby={explanation ? undefined : 'after-shift-title'} aria-describedby={key + '-hint'} value={state.answers[key]} maxLength={800} rows={explanation ? 3 : 5} onChange={event => dispatch({ type: 'ANSWER', key, value: event.target.value })} />
    <p className="reflection-field-hint" id={key + '-hint'}>Optional · a few words or sentences.<span aria-hidden="true">{800 - state.answers[key].length} characters left</span></p>
  </div>
  const radios = <K extends 'revision' | 'timePressure',>(key: K, options: readonly NonNullable<Answers[K]>[]) => <fieldset className="reflection-options" aria-labelledby="after-shift-title"><legend className="reflection-legend">Choose one, or skip this question</legend>
    {options.map(option => <label key={option}><input type="radio" name={key} value={option} checked={state.answers[key] === option} onChange={() => {
      if (key === 'revision') dispatch({ type: 'ANSWER', key, value: option as Answers['revision'] })
      else dispatch({ type: 'ANSWER', key, value: option as Answers['timePressure'] })
    }} /><span>{option}</span></label>)}
    {state.answers[key] && <button type="button" className="reflection-quiet" onClick={() => dispatch(key === 'revision' ? { type: 'ANSWER', key, value: null } : { type: 'ANSWER', key: 'timePressure', value: null })}>Clear selection</button>}
  </fieldset>

  return <section className={'after-shift ' + (finalResolution ? 'shift-finished' : state.page === 'invitation' ? 'shift-invitation' : 'shift-reflection')} aria-labelledby="after-shift-title" data-reflection-page={finalResolution ? 'finished' : state.page} data-survey-resolution={finalResolution ?? undefined} data-question={state.index + 1}>
    <div className="after-shift-scroll" key={state.page + ':' + state.index + ':' + finalResolution + ':' + confirmLeave}>
      <div className="after-shift-inner">
        <p className="reflection-eyebrow">Morrow <span aria-hidden="true">/</span> After the shift</p>
        {confirmLeave ? <>
          <h2 id="after-shift-title" tabIndex={-1} ref={heading}>{confirmLeave === 'replay' ? 'Start another shift?' : 'Finish without submitting?'}</h2>
          <p>{locked ? 'A save or export has already been attempted. It may exist on this computer. Leaving clears the answers from this page.' : 'Your unsaved answers will be cleared from this page. Nothing has been submitted.'}</p>
          <div className="reflection-actions"><button className="text-button" onClick={() => setConfirmLeave(null)}>Keep reflecting</button><button className="text-button" onClick={confirmLeave === 'replay' ? onReplay : finishWithoutSubmitting}>{confirmLeave === 'replay' ? 'Replay' : 'Continue without submitting'}</button></div>
        </> : finalResolution ? <>
          <h2 id="after-shift-title" tabIndex={-1} ref={heading}>Thank you for taking part.</h2>
          <p>Your shift is complete. You can leave here, begin again, or spend some time with the companion essays.</p>
          {saved ? <><p className="reflection-small">{status === 'saved' ? 'Your response has been saved on the facilitator’s computer. Nothing was sent to a public service.' : 'You confirmed that the response file is on this device. Please give the file to your facilitator; nothing was sent online.'}</p><p className="reflection-receipt">Response reference<br /><code>{submittedRecord?.responseId}</code></p></> : locked ? <p className="reflection-small">A save or export was attempted earlier and may exist on this computer. No further submission was made.<br />Response reference: <code>{submittedRecord?.responseId}</code></p> : <p className="reflection-small">No response was submitted.</p>}
          <div className="reflection-actions"><button className="text-button" onClick={onReplay}>Replay</button><button className="text-button" onClick={onLeave}>Leave</button></div>
          {companionsVisible(launchMode, narrative.phase, finalResolution) && <ReadingCompanions variant="ending" />}
          <BehindTheCounter />
        </> : state.page === 'invitation' ? <>
          <h2 id="after-shift-title" tabIndex={-1} ref={heading}>Your shift is over.</h2>
          <p className="shift-closing-line">The decisions have been made.<br />Some things may still be unresolved.</p>
          <p>Before you leave, we'd like to hear your account of what happened.</p>
          <p className="reflection-small">Six optional questions · about three minutes.<br />No time limit. Nothing is saved until you choose to save or export.</p>
          <div className="reflection-actions closing-actions"><button className="text-button reflection-primary" onClick={() => dispatch({ type: 'OPEN' })}>Reflect on the shift <span aria-hidden="true">↗</span></button><button className="text-button" onClick={() => leave('finish')}>Skip reflection</button><button className="text-button" onClick={() => leave('replay')}>Replay</button></div>
          <p className="reflection-credit">An interactive narrative by Mark Mathew</p>
        </> : state.page === 'question' ? <>
          <div className="reflection-progress" aria-label={`Question ${state.index + 1} of 6`}>{questions.map((_, index) => <span className={index <= state.index ? 'progress-visited' : ''} key={index} />)}</div>
          <p className="reflection-small question-count">Question {state.index + 1} of 6 · optional</p>
          <h2 id="after-shift-title" tabIndex={-1} ref={heading}>{questions[state.index]}</h2>
          {state.index === 0 && textField('interpretation')}
          {state.index === 1 && textField('influences')}
          {state.index === 2 && <>{radios('revision', revisionOptions)}{textField('revisionExplanation', true)}</>}
          {state.index === 3 && <><fieldset className="reflection-options" aria-labelledby="after-shift-title"><legend className="reflection-legend">Select all that apply, or skip this question</legend>{clarityOptions.map(option => <label key={option}><input type="checkbox" checked={state.answers.clarity.includes(option)} onChange={() => dispatch({ type: 'ANSWER', key: 'clarity', value: toggleClarity(state.answers.clarity, option) })} /><span>{option}</span></label>)}</fieldset>{textField('clarityExplanation', true)}</>}
          {state.index === 4 && textField('revisit')}
          {state.index === 5 && radios('timePressure', pressureOptions)}
          <nav className="reflection-navigation" aria-label="Reflection questions"><button className="text-button" onClick={() => dispatch({ type: 'BACK' })}>Back</button><button className="text-button reflection-skip" onClick={() => dispatch({ type: 'SKIP' })}>Skip</button><button className="text-button reflection-primary" onClick={() => dispatch({ type: 'NEXT' })}>{state.index === 5 ? 'Finish' : 'Next'} <span aria-hidden="true">→</span></button></nav>
          <button className="reflection-quiet reflection-leave" onClick={() => leave('finish')}>Finish without submitting</button>
        </> : <>
          <h2 id="after-shift-title" tabIndex={-1} ref={heading}>Would you like to save your account?</h2>
          <p>Every answer can be left blank. Saving is optional. Your account will help us understand the experience and improve it.</p>
          <p>{collector ? 'This local pilot saves a response file on the facilitator’s computer, in the pilot-responses folder.' : collector === null ? 'Checking whether local saving is available. You can also export a response file.' : 'Online collection is unavailable. Export a response file on this device and give it to your facilitator.'} No public collection is connected.</p>
          <p className="reflection-small">The file contains your answers, game version {GAME_VERSION}, play mode ({narrative.mode === 'timed' ? 'Timed' : 'Reflective'}), and a random response reference to prevent duplicate saves. We do not request your name, email or location. Please avoid identifying details in your answers. Drafts stay in memory and clear when you leave or replay. Your facilitator should keep response files private and delete them after summarising the pilot.</p>
          <fieldset className="reflection-options consent-options" disabled={locked || status === 'saving'}><legend>Choose what to include</legend>
            <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I agree to save or export my answers, game version and play mode.</span></label>
            <label><input type="checkbox" checked={historyConsent} onChange={event => setHistoryConsent(event.target.checked)} /><span>Also include my three decisions, unanswered moments and response timing. <small>Optional</small></span></label>
            {entry && <label><input type="checkbox" checked={entryConsent} onChange={event => setEntryConsent(event.target.checked)} /><span>Also include that I opened the unprimed pilot link. <small>Optional · the link does not establish prior exposure.</small></span></label>}
          </fieldset>
          {!consent && <p className="reflection-small">Tick the first box only if you agree to save or export. You can also finish without submitting.</p>}
          {status === 'error' && <p className="reflection-error" role="alert" tabIndex={-1} ref={errorMessage}>Saving was not confirmed. Your answers remain here; they may already have been saved. Retry uses the same response reference to prevent duplicates. You can also export the same response.<br />Response reference: <code>{submittedRecord?.responseId}</code></p>}
          {exportError && <p className="reflection-error" role="alert">The export could not start. Your answers remain here. Try again or ask your facilitator to record them with your consent.</p>}
          {status === 'export-requested' && <div className="reflection-export-check" role="status"><p>Export requested. This page cannot verify that your browser saved the file. Look for <code>the-counter-response-{submittedRecord?.responseId}.json</code> in Downloads.</p><button className="text-button" onClick={() => setStatus('export-confirmed')}>I have located the exported file</button></div>}
          {status === 'saving' && <p role="status">Saving on this computer…</p>}
          <nav className="reflection-navigation" aria-label="Save your account"><button className="text-button" disabled={locked} onClick={() => dispatch({ type: 'BACK' })}>Back</button>{collector && <button className="text-button reflection-primary" disabled={!consent || status === 'saving'} onClick={() => void save()}>{status === 'error' ? 'Retry local save' : 'Save response locally'}</button>}{!collector && <button className="text-button reflection-primary" disabled={!consent || status === 'saving'} onClick={download}>Export response file</button>}</nav>
          {collector && <button className="reflection-quiet" disabled={!consent || status === 'saving'} onClick={download}>Export a JSON file instead</button>}
          <button className="reflection-quiet reflection-leave" disabled={status === 'saving'} onClick={() => leave('finish')}>Finish without submitting</button>
        </>}
      </div>
    </div>
  </section>
}
