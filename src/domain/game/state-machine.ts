import type { GameAction, GamePhase } from './game-types';
const ALLOWED: Record<GamePhase, readonly GameAction['type'][]> = {
  LOBBY: ['START_GAME', 'ABANDON_GAME'], READY: ['BEGIN_TURN', 'ABANDON_GAME'], TURN_INTRO: ['BEGIN_TURN', 'ABANDON_GAME'],
  QUESTION: ['REVEAL_ANSWER', 'JUDGE_CORRECT', 'JUDGE_INCORRECT', 'ABANDON_GAME'], TP_OPEN: ['CLAIM_TP', 'ABANDON_GAME'],
  TP_CLAIMED: ['REVEAL_ANSWER', 'JUDGE_CORRECT', 'JUDGE_INCORRECT', 'ABANDON_GAME'], ANSWER_REVEALED: ['JUDGE_CORRECT', 'JUDGE_INCORRECT', 'ABANDON_GAME'],
  JUDGING: ['JUDGE_CORRECT', 'JUDGE_INCORRECT', 'ABANDON_GAME'], RESULT: ['NEXT_TURN', 'ABANDON_GAME'], MOVING: [],
  BETWEEN_TURNS: ['NEXT_TURN', 'ABANDON_GAME'], FINISHED: [],
};
export function isActionAllowed(phase: GamePhase, action: GameAction['type']): boolean { return ALLOWED[phase].includes(action); }
