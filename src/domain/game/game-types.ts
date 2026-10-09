export type PlayerRole = 'PAU' | 'TECLA';
export type GameMode = 'IN_PERSON' | 'ONLINE';
export type GameStatus = 'LOBBY' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type GamePhase = 'LOBBY' | 'READY' | 'TURN_INTRO' | 'QUESTION' | 'TP_OPEN' | 'TP_CLAIMED' | 'ANSWER_REVEALED' | 'JUDGING' | 'RESULT' | 'MOVING' | 'BETWEEN_TURNS' | 'FINISHED';
export type QuestionPool = 'PAU' | 'TECLA' | 'TECLA_PAU' | 'PAU_TECLA' | 'TP';
export type CellType = 'PERSONAL' | 'CROSSED' | 'TP';
export type CellModifier = 'NONE' | 'PLUS_ONE';
export type ReviewStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export interface BoardCell {
  position: number;
  type: CellType;
  modifier: CellModifier;
}

export interface PlayerPositions { PAU: number; TECLA: number }

export interface GameSnapshot {
  id: string;
  coupleId: string;
  inviteCode: string | null;
  mode: GameMode;
  status: GameStatus;
  phase: GamePhase;
  currentTurn: PlayerRole;
  startingPlayer: PlayerRole;
  targetMinutes: number;
  finishPosition: number;
  currentTargetCell: number | null;
  tpClaimant: PlayerRole | null;
  respondingPlayer: PlayerRole | null;
  pauPosition: number;
  teclaPosition: number;
  turnNumber: number;
  stateVersion: number;
  winner: PlayerRole | null;
}

export type GameAction =
  | { type: 'BEGIN_TURN' | 'REVEAL_ANSWER' | 'JUDGE_CORRECT' | 'JUDGE_INCORRECT' | 'NEXT_TURN' | 'ABANDON_GAME' | 'START_GAME' }
  | { type: 'CLAIM_TP'; claimant: PlayerRole };

export interface ActionEnvelope {
  gameId: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  action: GameAction;
}
