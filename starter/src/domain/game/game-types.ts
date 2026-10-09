export type PlayerRole = "PAU" | "TECLA";
export type GameMode = "IN_PERSON" | "ONLINE";
export type GameStatus = "LOBBY" | "ACTIVE" | "FINISHED" | "ABANDONED";
export type GamePhase =
  | "LOBBY"
  | "READY"
  | "TURN_INTRO"
  | "QUESTION"
  | "TP_OPEN"
  | "TP_CLAIMED"
  | "ANSWER_REVEALED"
  | "JUDGING"
  | "RESULT"
  | "MOVING"
  | "BETWEEN_TURNS"
  | "FINISHED";

export type QuestionPool = "PAU" | "TECLA" | "TECLA_PAU" | "PAU_TECLA" | "TP";
export type CellType = "PERSONAL" | "CROSSED" | "TP";
export type CellModifier = "NONE" | "PLUS_ONE";
export type ReviewStatus = "DRAFT" | "APPROVED" | "ARCHIVED";

export interface Question {
  id: string;
  pool: QuestionPool;
  topic: string;
  difficulty: 1 | 2 | 3;
  questionCa: string;
  answerCa: string;
  reviewStatus: ReviewStatus;
  factualReviewed: boolean;
  languageReviewed: boolean;
  active: boolean;
  sourceType: string;
  notes: string;
  contentVersion: number;
}

export interface BoardCell {
  position: number;
  type: CellType;
  modifier: CellModifier;
}

export interface PlayerPositions {
  PAU: number;
  TECLA: number;
}

export interface GameSnapshot {
  id: string;
  mode: GameMode;
  status: GameStatus;
  phase: GamePhase;
  currentTurn: PlayerRole;
  startingPlayer: PlayerRole;
  targetMinutes: number;
  finishPosition: number;
  currentTargetCell: number | null;
  currentQuestionId: string | null;
  tpClaimant: PlayerRole | null;
  positions: PlayerPositions;
  turnNumber: number;
  stateVersion: number;
  winner: PlayerRole | null;
  board: BoardCell[];
}

export type GameAction =
  | { type: "BEGIN_TURN" }
  | { type: "REVEAL_ANSWER" }
  | { type: "CLAIM_TP"; claimant: PlayerRole }
  | { type: "JUDGE_CORRECT" }
  | { type: "JUDGE_INCORRECT" }
  | { type: "NEXT_TURN" }
  | { type: "ABANDON_GAME" };

export interface ActionEnvelope<TAction extends GameAction = GameAction> {
  gameId: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  action: TAction;
}
