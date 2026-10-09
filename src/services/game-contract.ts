import type { BoardCell, GameSnapshot, PlayerRole, QuestionPool } from '../domain/game/game-types';
export type { GameAction, GameMode, PlayerRole } from '../domain/game/game-types';

export type ViewerRole = PlayerRole | 'IN_PERSON_CONTROLLER';

export interface GameEvent {
  id: string | number;
  type: string;
  payload: Record<string, unknown>;
  stateVersion: number;
  createdAt: string;
}

/** The optional answer is omitted by the server for the responding device. */
export interface SafeQuestion {
  id: string;
  pool: QuestionPool;
  topic: string;
  questionCa: string;
  answerCa?: string;
}

export interface Scoreboard { pauWins: number; teclaWins: number; completedGames: number }

export interface GameCapabilities {
  canSeeAnswer: boolean;
  canJudge: boolean;
  canBeginTurn: boolean;
  canReveal: boolean;
  canClaim: boolean;
  canNextTurn: boolean;
  canStart: boolean;
  canAbandon: boolean;
}

export interface GameView {
  game: GameSnapshot;
  viewer: { role: ViewerRole; userId: string };
  board: BoardCell[];
  question: SafeQuestion | null;
  capabilities: GameCapabilities;
  members: { role: ViewerRole }[];
  lastEvent: GameEvent | null;
  scoreboard: Scoreboard;
}
