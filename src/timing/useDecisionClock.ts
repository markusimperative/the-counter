import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { NarrativeEvent, NarrativeState } from '../narrative/types'
import { ActiveClock } from './ActiveClock'
import type { MonotonicClock } from './ActiveClock'

const browserClock: MonotonicClock = { now: () => performance.now() }

/** One adapter owns scheduling, visibility and suspension for the current decision. */
export function useDecisionClock(state: NarrativeState, dispatch: Dispatch<NarrativeEvent>, source: MonotonicClock = browserClock) {
  const current = useRef<{ key: string; clock: ActiveClock } | null>(null)
  const key = state.decision?.key
  const status = state.decision?.status
  useEffect(() => {
    if (state.mode !== 'timed' || state.phase !== 'decision' || status !== 'active' || !key) return
    const clock = new ActiveClock(source)
    current.current = { key, clock }
    let frozen = false
    let pageHidden = false
    let cancelled = false
    const suspended = () => document.hidden || frozen || pageHidden
    clock.setSuspended(suspended())
    const tick = () => {
      if (!cancelled && !suspended()) dispatch({ type: 'ADVANCE_TIME', decisionKey: key, elapsedMs: clock.sample() })
    }
    const visibility = () => { clock.setSuspended(suspended()); if (!suspended()) tick() }
    const freeze = () => { frozen = true; visibility() }
    const resume = () => { frozen = false; visibility() }
    const hide = () => { pageHidden = true; visibility() }
    const show = () => { pageHidden = false; visibility() }
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('freeze', freeze)
    document.addEventListener('resume', resume)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    const timer = window.setInterval(tick, 100)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('freeze', freeze)
      document.removeEventListener('resume', resume)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      if (current.current?.key === key) current.current = null
    }
  }, [state.mode, state.phase, key, status, dispatch, source])

  // Gestures sample the same clock synchronously, even if the last interval is late.
  return (decisionKey: string) => current.current?.key === decisionKey ? current.current.clock.sample() : 0
}
