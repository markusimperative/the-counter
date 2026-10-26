import { useEffect, useReducer, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Soundscape } from './audio/Soundscape'
import { Scene } from './components/Scene'
import { DialogueBubble } from './components/DialogueBubble'
import { SituationReview } from './components/SituationReview'
import { ResponseWindow } from './components/ResponseWindow'
import { immediateSituation } from './presentation/context'
import { AfterShift } from './components/AfterShift'
import { ReadingCompanions } from './components/ReadingCompanions'
import { companionsVisible, launchModeFromSearch } from './reading/companions'
import { GAME_VERSION, hasInvitation } from './reflection/model'
import { artwork } from './assets'
import { createInitialState, currentBeat, formatStoryTime, narrativeReducer } from './narrative/engine'
import { voiceCatalog } from './performance/voiceCatalog'
import { usePerformance } from './performance/usePerformance'
import { sceneForId } from './narrative/story'
import { activeTemporalCue, noResponseContent, responseWindowsMs } from './narrative/decisionContent'
import { useDecisionClock } from './timing/useDecisionClock'
import type { ChoiceId, NarrativeEvent, NarrativeState, PlayMode } from './narrative/types'
import './styles.css'
import './dialogue-bubbles.css'
import './decision-clarity.css'
import './components/title-screen.css'

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="arrow-icon"><path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.3" /></svg>
}

function SoundIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />{muted ? <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.3" /> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}</svg>
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(query.matches)
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  }, [])
  return reduced
}

function gameReducer(state: NarrativeState, event: NarrativeEvent) {
  return narrativeReducer(state, event)
}

function useCompactOpening() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px), (max-height: 660px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px), (max-height: 660px)')
    const changed = () => setCompact(query.matches)
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  }, [])
  return compact
}

export default function App() {
  const [narrative, dispatch] = useReducer(gameReducer, undefined, () => createInitialState())
  const [playMode, setPlayMode] = useState<PlayMode>('timed')
  const [launchMode] = useState(() => launchModeFromSearch(window.location.search))
  const [readingSupport, setReadingSupport] = useState(false)
  const compactOpening = useCompactOpening() || readingSupport
  const readingDialogRef = useRef<HTMLDialogElement>(null)
  const [lessMotion, setLessMotion] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [muted, setMuted] = useState(false)
  const [audioAvailable, setAudioAvailable] = useState(true)
  const [committing, setCommitting] = useState<{ choiceId: ChoiceId; snapshot: NarrativeState } | null>(null)
  const state = committing?.snapshot ?? narrative
  const sampleTime = useDecisionClock(narrative, dispatch)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [run, setRun] = useState(0)
  const systemReducedMotion = useReducedMotion()
  const reducedMotion = systemReducedMotion || lessMotion
  const [sound] = useState(() => new Soundscape())
  const continueRef = useRef<HTMLButtonElement>(null)
  const beginRef = useRef<HTMLButtonElement>(null)
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([])
  const focusRef = useRef<HTMLDivElement>(null)
  const dialogueRegionRef = useRef<HTMLElement>(null)
  const voiceTimerRef = useRef<number | undefined>(undefined)
  const audioRunRef = useRef(0)
  const playedCues = useRef(new Set<string>())
  const beat = currentBeat(state)
  const scene = sceneForId(state.sceneId)
  const endingBeat = state.phase === 'ending' ? state.selectedChoice === 'NO_RESPONSE' ? noResponseContent(scene).beats.at(-1) : scene.choices.find(choice => choice.id === state.selectedChoice)?.beats.at(-1) : undefined
  const performance = usePerformance(beat ?? endingBeat, reducedMotion, run)
  const decisionActive = state.phase === 'decision' && state.decision?.status === 'active'
  const temporalCue = activeTemporalCue(state)
  const speakingBeat = temporalCue && temporalCue.speaker !== 'Scene' ? temporalCue : beat
  const scenePerformance = temporalCue ? { ...performance, pose: temporalCue.pose, gesture: reducedMotion ? 'still' : temporalCue.performance.gesture } : performance
  const voiceId = beat?.performance.voiceId
  const voiceLine = beat?.line
  const voiceSpeaker = beat?.speaker
  const voiceDelay = beat?.performance.voiceDelayMs

  useEffect(() => {
    let active = true
    void Promise.all(artwork.map(url => new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => { void image.decode().then(() => resolve()).catch(() => resolve()) }
      image.onerror = () => reject(new Error(url))
      image.src = url
    }))).then(() => { if (active) setLoaded(true) }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [loadAttempt])

  useEffect(() => {
    const audio = sound
    const visibility = () => { if (document.hidden) audio.suspend(); else audio.resume() }
    const leave = () => audio.stop()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', leave)
      audio.stop()
    }
  }, [sound])

  useEffect(() => {
    if (state.phase !== 'opening') return
    const timer = window.setTimeout(() => dispatch({ type: 'OPENING_COMPLETE' }), reducedMotion ? 120 : scene.openingDuration)
    return () => window.clearTimeout(timer)
  }, [state.phase, reducedMotion, run, scene.id, scene.openingDuration])

  useEffect(() => {
    if (!beat?.sound) return
    const key = run + ':' + beat.id
    if (!playedCues.current.has(key)) {
      playedCues.current.add(key)
      sound?.play(beat.sound)
    }
  }, [beat?.id, beat?.sound, run, sound])

  useEffect(() => {
    if (committing || decisionActive || !voiceId) return
    const clip = voiceCatalog[voiceId]
    if (!clip || clip.text !== voiceLine) return
    const timer = window.setTimeout(() => { voiceTimerRef.current = undefined; void sound.speak(clip.src, ['Kitchen', 'Colleague', 'Manager'].includes(voiceSpeaker ?? '')) }, voiceDelay)
    voiceTimerRef.current = timer
    return () => { window.clearTimeout(timer); voiceTimerRef.current = undefined; sound.stopDialogue() }
  }, [voiceId, voiceLine, voiceSpeaker, voiceDelay, decisionActive, run, sound, committing])

  useEffect(() => {
    if (!temporalCue || committing) return
    const key = `${run}:${state.decision?.key}:${temporalCue.id}`
    if (playedCues.current.has(key)) return
    playedCues.current.add(key)
    sound.stopDialogue()
    if (temporalCue.sound) sound.play(temporalCue.sound)
    const clip = temporalCue.performance.voiceId && voiceCatalog[temporalCue.performance.voiceId]
    if (clip && clip.text === temporalCue.line) void sound.speak(clip.src, temporalCue.speaker !== 'Customer')
    return () => sound.stopDialogue()
  }, [temporalCue, state.decision?.key, run, sound, committing])

  useEffect(() => {
    if (!committing) return
    const timer = window.setTimeout(() => {
      setCommitting(null)
    }, reducedMotion ? 0 : 440)
    return () => window.clearTimeout(timer)
  }, [committing, reducedMotion])

  useEffect(() => {
    dialogueRegionRef.current?.scrollTo({ top: 0 })
    if (['encounter', 'consequence', 'transition'].includes(state.phase) || (state.phase === 'decision' && !decisionActive)) continueRef.current?.focus({ preventScroll: true })
    if (decisionActive) focusRef.current?.focus({ preventScroll: true })
    if (state.phase === 'title' && run > 0) beginRef.current?.focus()
  }, [state.phase, state.beatIndex, state.chapter, state.decision?.status, decisionActive, run])

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
      if (decisionActive && !committing && /^[123]$/.test(event.key)) {
        event.preventDefault()
        choiceRefs.current[Number(event.key) - 1]?.focus()
      } else if (event.key === 'Enter' && (event.target === document.body || event.target === focusRef.current)) {
        if (['encounter', 'consequence', 'transition'].includes(state.phase)) { event.preventDefault(); sound.stopDialogue(); dispatch({ type: 'ADVANCE' }) }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state.phase, decisionActive, committing, sound])

  const start = (replay = false) => {
    if (!loaded) return
    playedCues.current.clear()
    setCommitting(null)
    setLook({ x: 0, y: 0 })
    setRun(value => value + 1)
    const audioRun = ++audioRunRef.current
    void sound.start(muted).then(available => { if (audioRunRef.current === audioRun) setAudioAvailable(available) })
    dispatch(replay ? { type: 'REPLAY' } : { type: 'BEGIN', mode: playMode })
  }
  const exit = () => {
    audioRunRef.current++
    sound?.stop()
    setCommitting(null)
    dispatch({ type: 'EXIT' })
  }
  const toggleSound = () => {
    const next = !muted
    sound.setMuted(next)
    setMuted(next)
  }
  const choose = (choiceId: ChoiceId) => {
    if (committing || narrative.decision?.status !== 'active' || !narrative.decision.key) return
    const elapsedMs = sampleTime(narrative.decision.key)
    const event: NarrativeEvent = { type: 'CHOOSE', choiceId, decisionKey: narrative.decision.key, elapsedMs }
    const result = narrativeReducer(narrative, event)
    sound.stopDialogue()
    dispatch(event)
    if (result.phase === 'consequence' && result.selectedChoice === choiceId) {
      sound.select()
      setCommitting({ choiceId, snapshot: { ...narrative, storyTimeSeconds: result.storyTimeSeconds, decision: { ...result.decision!, status: 'active', resolution: null } } })
    }
  }
  const navigateChoices = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const directions: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    if (directions[event.key]) {
      event.preventDefault()
      choiceRefs.current[(index + directions[event.key] + scene.choices.length) % scene.choices.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      choiceRefs.current[event.key === 'Home' ? 0 : scene.choices.length - 1]?.focus()
    }
  }

  return <main className={'experience chapter-' + state.chapter + ' phase-' + state.phase + (state.chapter >= 2 ? ' later-chapter' : '') + (reducedMotion ? ' reduced-motion' : '') + (readingSupport ? ' reading-support' : '')} data-version={GAME_VERSION} data-reading-support={readingSupport} data-mode={state.mode} data-decision-status={state.decision?.status} data-resolution={narrative.selectedChoice ?? ''} data-chapter={state.chapter} data-phase={state.phase} data-choice={state.selectedChoice ?? ''} data-beat={beat?.id ?? ''} onPointerMove={event => {
    if (reducedMotion || decisionActive || event.pointerType !== 'mouse' || state.phase === 'title' || state.phase === 'ending') return
    setLook({ x: (event.clientX / window.innerWidth - 0.5) * 5, y: (event.clientY / window.innerHeight - 0.5) * 3 })
  }} onPointerLeave={() => setLook({ x: 0, y: 0 })}>
    <Scene key={run} state={state} look={look} performance={scenePerformance} />
    <header className="game-header">
      {state.phase === 'title' && launchMode === 'public' && import.meta.env.BASE_URL === '/experiments/the-counter/'
        ? <a className="wordmark experiment-back-link" href="/experiments/"><span aria-hidden="true">←</span> EXPERIMENTS</a>
        : <span className="wordmark">THE COUNTER<span className="wordmark-dot" /></span>}
      {state.phase !== 'title' && <span className="chapter-label">0{state.chapter} <span>/</span> {scene.title.toUpperCase()}</span>}
      {state.phase !== 'title' && <span className="mode-label">{state.mode === 'timed' ? 'Timed' : 'Reflective'}</span>}
      <div className="header-actions">
      {state.phase !== 'title' && state.phase !== 'ending' && <button className="exit-shift" onClick={exit}>Exit shift</button>}
      <button className="sound-control" onClick={toggleSound} disabled={!audioAvailable} aria-label={!audioAvailable ? 'Sound unavailable' : muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} title={audioAvailable ? 'Toggle restaurant audio' : 'Audio unavailable. Captions remain available.'}>
        <SoundIcon muted={muted || !audioAvailable} /><span>{!audioAvailable ? 'Sound unavailable' : muted ? 'Sound off' : 'Sound on'}</span>
      </button>
      </div>
    </header>

    {state.phase === 'title' && <section className="title-screen" aria-labelledby="game-title">
      <div className="title-layout">
      <div className="title-primary">
      <div className="title-intro">
      <div className="title-overline"><span /> A MOMENT AT MORROW</div>
      <h1 id="game-title">The <em>Counter.</em></h1>
      <p className="title-premise">Every day, a hundred small decisions.<br />This one is yours.</p>
      </div>
      <div className="title-setup">
      <p className="time-introduction">Situations may change while you decide. In Timed play, waiting can lead to an unanswered situation. Reflective play has no response deadline.</p>
      <fieldset className="mode-picker"><legend>How will you play?</legend>
        <label><input type="radio" name="play-mode" value="timed" checked={playMode === 'timed'} disabled={readingSupport} onChange={() => setPlayMode('timed')} /><span>Timed<small>{responseWindowsMs[1] / 1000} / {responseWindowsMs[2] / 1000} / {responseWindowsMs[3] / 1000} second windows</small></span></label>
        <label><input type="radio" name="play-mode" value="reflective" checked={playMode === 'reflective'} onChange={() => setPlayMode('reflective')} /><span>Reflective<small>No deadline while choosing</small></span></label>
      </fieldset>
      <p className="mode-reading-note">Read the scene first. The window starts when you open responses. In Timed play, Review does not pause it.</p>
      <details className="accessibility-options"><summary>Reading and motion options</summary>
        <label className="reading-option"><input type="checkbox" checked={readingSupport} onChange={event => { setReadingSupport(event.target.checked); if (event.target.checked) setPlayMode('reflective') }} /><span>Reading support<small>200% dialogue and choices · Reflective, no deadline</small></span></label>
        <label className="reading-option"><input type="checkbox" checked={reducedMotion} disabled={systemReducedMotion} onChange={event => setLessMotion(event.target.checked)} /><span>Reduce motion<small>{systemReducedMotion ? 'Your device already requests reduced motion.' : 'Still characters and short transitions. Timing stays the same.'}</small></span></label>
      </details>
      {readingSupport && <p className="reading-accommodation" role="status">Reading support is on: 200% text in Reflective, with no time limit. Turn it off to select Timed. Use Reflective for enlarged text or magnification.</p>}
      <div className="begin-area">
        <div className="title-start-actions">
        {loadError ? <><p role="alert" className="asset-error">A scene asset couldn’t load. Please try again.</p><button className="begin-button" onClick={() => { setLoadError(false); setLoadAttempt(value => value + 1) }}>Reload scene <Arrow /></button></>
          : <button className="begin-button" ref={beginRef} disabled={!loaded} onClick={() => start()}>{loaded ? 'Begin shift' : 'Preparing the scene'}{loaded ? <Arrow /> : <span className="loading-mark" />}</button>}
        {companionsVisible(launchMode, state.phase) && compactOpening && <button className="opening-reading-trigger" onClick={() => readingDialogRef.current?.showModal()}>Reading Companions <span aria-hidden="true">↗</span></button>}
        </div>
        <span className="experience-note">THREE CHAPTERS <span>·</span> {playMode.toUpperCase()} PLAY</span>
      </div>
      </div>
      <footer className="title-credit">
      <p className="author-credit">AN INTERACTIVE NARRATIVE BY <strong>MARK MATHEW</strong></p>
      <span className="private-label">PRIVATE EXPERIENCE PROTOTYPE</span>
      </footer>
      </div>
      {companionsVisible(launchMode, state.phase) && !compactOpening && <ReadingCompanions variant="opening" />}
      </div>
      {companionsVisible(launchMode, state.phase) && compactOpening && <dialog className="opening-reading-dialog" ref={readingDialogRef} aria-labelledby="reading-companions-opening">
        <button className="opening-reading-close" onClick={() => readingDialogRef.current?.close()}>Close reading <span aria-hidden="true">×</span></button>
        <ReadingCompanions variant="opening" />
      </dialog>}
    </section>}

    {state.phase === 'opening' && <div className="opening-location" aria-live="polite"><span>{state.chapter >= 2 ? `0${state.chapter} — ${scene.title.toUpperCase()}` : 'MORROW'}</span><p>{formatStoryTime(state.storyTimeMinutes)}</p><small>{state.chapter === 3 ? 'A reply. A change to the order.' : state.chapter === 2 ? 'The same shift. Another customer.' : 'The lunch rush.'}</small></div>}

    {beat && <section ref={dialogueRegionRef} className={'dialogue-region ' + (decisionActive ? 'decision-region focused-decision' : '')} aria-label={decisionActive ? 'Choose your response' : 'Conversation'}>
      {decisionActive && <div className="decision-top">
        <div className="decision-context" ref={focusRef} tabIndex={-1}><span>Morrow · {scene.title}</span><p>{immediateSituation(state)}</p></div>
        <ResponseWindow state={state} />
      </div>}
      <div className={decisionActive ? 'decision-voice' : 'dialogue-content'}>
      <div className="dialogue-copy" key={beat.id}>
        <DialogueBubble beat={speakingBeat ?? beat} chapter={state.chapter} pendingQuestion={speakingBeat && speakingBeat.id !== beat.id ? beat.line : undefined} />
      </div>
      {decisionActive && temporalCue?.speaker === 'Scene' && <p className="decision-room-cue" aria-hidden="true">{temporalCue.caption}</p>}
      {!decisionActive && <>
        {state.phase === 'decision' && <p className="briefing-note">{state.mode === 'timed' ? `${responseWindowsMs[state.chapter] / 1000} seconds once responses open. Review keeps time moving.` : 'Reflective play has no response deadline.'}</p>}
        <div className="dialogue-controls"><SituationReview key={beat.id} state={state} onReview={() => { window.clearTimeout(voiceTimerRef.current); voiceTimerRef.current = undefined; sound.stopDialogue() }} muted={muted} onToggleSound={toggleSound} audioAvailable={audioAvailable} />
        <button className="text-button continue-button" ref={continueRef} onClick={() => { sound.stopDialogue(); dispatch(state.phase === 'decision' ? { type: 'ACTIVATE_DECISION', decisionKey: `${run}:${state.sceneId}` } : { type: 'ADVANCE' }) }}>{state.phase === 'decision' ? 'Open responses' : 'Continue'} <span className="key-hint">↵</span><Arrow /></button></div>
      </>}
      </div>
      {decisionActive ? <>
        <div className="decision-actions"><h2 className="decision-prompt">How do you respond?</h2><SituationReview state={state} onReview={() => { window.clearTimeout(voiceTimerRef.current); voiceTimerRef.current = undefined; sound.stopDialogue() }} muted={muted} onToggleSound={toggleSound} audioAvailable={audioAvailable} /></div>
        <div className={'choices ' + (committing ? 'choices-committing' : '')}>
          {scene.choices.map((choice, index) => <button key={choice.id} className={'choice-card ' + (committing?.choiceId === choice.id ? 'choice-committed' : '')} ref={node => { choiceRefs.current[index] = node }} onKeyDown={event => navigateChoices(event, index)} disabled={committing !== null} onClick={() => choose(choice.id)} data-choice={choice.id}>
            <span className="choice-number" aria-hidden="true">0{index + 1}</span><span className="choice-text">{choice.text}</span><Arrow />
          </button>)}
        </div>
        <p className="controls-hint"><span>{state.mode === 'timed' ? 'Review keeps time moving.' : 'Reflective · no deadline'}</span><span className="keyboard-hint">1–3 TO FOCUS <i /> ENTER TO CHOOSE</span></p>
      </> : null}
    </section>}

    {hasInvitation(state) && <AfterShift key={'after-shift:' + run} narrative={state} launchMode={launchMode} onReplay={() => start(true)} onLeave={exit} />}

    {state.phase !== 'title' && state.phase !== 'ending' && <p className="sound-caption" aria-label="Sound and scene captions" aria-live="polite"><span className="caption-symbol" aria-hidden="true">♪</span>{temporalCue ? temporalCue.speaker === 'Scene' ? temporalCue.caption : 'Kitchen hum. Footsteps and distant conversation.' : beat?.caption ?? 'Kitchen hum. Footsteps and distant conversation.'}</p>}
    {state.phase !== 'title' && <span className="scene-footer" aria-hidden="true">MORROW <i /> {formatStoryTime(state.storyTimeMinutes, state.mode === 'timed' ? state.storyTimeSeconds : undefined)}</span>}
  </main>
}




