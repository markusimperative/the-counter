import { useEffect, useState } from 'react'
import type { BeatDefinition, CustomerPose } from '../narrative/types'

/** A presentation-only score. Cancelling it cannot alter narrative state. */
export function usePerformance(beat: BeatDefinition | undefined, reduced: boolean, run: number) {
  const key = `${run}:${beat?.id ?? 'quiet'}`
  const [settled, setSettled] = useState('')
  useEffect(() => {
    if (!beat?.performance.startPose || reduced) return
    const timer = window.setTimeout(() => setSettled(key), beat.performance.settleMs ?? 350)
    return () => window.clearTimeout(timer)
  }, [key, beat?.performance.startPose, beat?.performance.settleMs, reduced])
  const pose: CustomerPose = beat && !reduced && settled !== key
    ? beat.performance.startPose ?? beat.pose : beat?.pose ?? 'neutral'
  return { pose, gesture: reduced ? 'still' : beat?.performance.gesture ?? 'still', camera: reduced ? '' : beat?.performance.camera ?? '' }
}
