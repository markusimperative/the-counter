import { advanceTime, createInitialState, narrativeReducer } from '../narrative/engine'
import { responseWindowsMs } from '../narrative/decisionContent'
import type { PlayMode, ResolutionId } from '../narrative/types'

export function playEnding(choices: readonly ResolutionId[] = ['B', 'B', 'C'], mode: PlayMode = 'timed') {
  let state = narrativeReducer(createInitialState(), { type: 'BEGIN', mode })
  for (const choice of choices) {
    state = narrativeReducer(state, { type: 'OPENING_COMPLETE' })
    while (state.phase === 'encounter') state = narrativeReducer(state, { type: 'ADVANCE' })
    state = narrativeReducer(state, { type: 'ACTIVATE_DECISION', decisionKey: 'reflection-test:' + state.sceneId })
    state = choice === 'NO_RESPONSE' ? advanceTime(state, responseWindowsMs[state.chapter]) : narrativeReducer(state, { type: 'CHOOSE', choiceId: choice, elapsedMs: 1200, decisionKey: state.decision!.key! })
    while (state.phase === 'consequence') state = narrativeReducer(state, { type: 'ADVANCE' })
    if (state.phase === 'transition') state = narrativeReducer(state, { type: 'ADVANCE' })
  }
  return state
}
