import type { PlayerRole } from '../domain/game/game-types';
import type { GameView } from '../services/game-contract';

interface EffectIdentity { gameId: string; stateVersion: number; id: string }
export type ConfirmedGameEffect = EffectIdentity & (
  | { type: 'QUESTION_ENTER' | 'ANSWER_REVEAL' }
  | { type: 'CORRECT_AND_MOVE'; player: PlayerRole; from: number; to: number; plusOne: boolean; fromOffsetX?: number }
  | { type: 'INCORRECT_AND_DRINK'; drinkCount: 1 | 2 }
  | { type: 'TP_CLAIM'; variant: 'won' | 'lost'; claimant: PlayerRole }
  | { type: 'VICTORY'; winner: PlayerRole }
);

function player(value: unknown): value is PlayerRole { return value === 'PAU' || value === 'TECLA'; }
function finiteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

/** Uses only safe, confirmed views. A refresh establishes a baseline, never a replay. */
export function effectsBetween(previous: GameView | null, next: GameView): ConfirmedGameEffect[] {
  if (!previous || previous.game.id !== next.game.id || next.game.stateVersion <= previous.game.stateVersion) return [];
  const identity = { gameId: next.game.id, stateVersion: next.game.stateVersion, id: String(next.lastEvent?.id ?? next.game.stateVersion) };
  const effects: ConfirmedGameEffect[] = [];
  const payload = next.lastEvent?.stateVersion === next.game.stateVersion ? next.lastEvent.payload : {};
  if (next.question && previous.question?.id !== next.question.id) effects.push({ ...identity, type: 'QUESTION_ENTER' });
  if (next.game.phase === 'ANSWER_REVEALED' && previous.game.phase !== 'ANSWER_REVEALED' && next.capabilities.canSeeAnswer) effects.push({ ...identity, type: 'ANSWER_REVEAL' });
  if (next.game.tpClaimant && next.game.tpClaimant !== previous.game.tpClaimant && next.game.phase === 'TP_CLAIMED') {
    effects.push({ ...identity, type: 'TP_CLAIM', variant: 'won', claimant: next.game.tpClaimant });
  }
  const changedPlayer = next.game.pauPosition > previous.game.pauPosition ? 'PAU' : next.game.teclaPosition > previous.game.teclaPosition ? 'TECLA' : null;
  const respondent = player(payload.respondingPlayer) ? payload.respondingPlayer : changedPlayer;
  const resultPhases = ['RESULT', 'MOVING', 'BETWEEN_TURNS'];
  const newlyJudged = !resultPhases.includes(previous.game.phase) && previous.game.status !== 'FINISHED' && (resultPhases.includes(next.game.phase) || next.game.status === 'FINISHED');
  if (newlyJudged && (payload.correct === true || changedPlayer) && respondent) {
    const from = finiteNumber(payload.from) ? payload.from : respondent === 'PAU' ? previous.game.pauPosition : previous.game.teclaPosition;
    const to = finiteNumber(payload.to) ? payload.to : respondent === 'PAU' ? next.game.pauPosition : next.game.teclaPosition;
    const samePosition = previous.game.pauPosition === previous.game.teclaPosition;
    effects.push({ ...identity, type: 'CORRECT_AND_MOVE', player: respondent, from, to, plusOne: payload.plusOne === true || to - from === 2, fromOffsetX: samePosition ? respondent === 'PAU' ? -18 : 18 : 0 });
  } else if (newlyJudged && payload.correct === false) {
    effects.push({ ...identity, type: 'INCORRECT_AND_DRINK', drinkCount: payload.drinkCount === 2 ? 2 : 1 });
  }
  if (next.game.status === 'FINISHED' && previous.game.status !== 'FINISHED' && next.game.winner) effects.push({ ...identity, type: 'VICTORY', winner: next.game.winner });
  return effects;
}
