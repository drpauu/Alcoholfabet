import type {
  BoardCell,
  CellType,
  PlayerRole,
  QuestionPool,
} from "./game-types";

export function otherPlayer(player: PlayerRole): PlayerRole {
  return player === "PAU" ? "TECLA" : "PAU";
}

export function poolForCell(cellType: CellType, currentTurn: PlayerRole): QuestionPool {
  if (cellType === "TP") return "TP";
  if (cellType === "PERSONAL") return currentTurn;
  return currentTurn === "PAU" ? "PAU_TECLA" : "TECLA_PAU";
}

export interface CorrectResolution {
  primaryPosition: number;
  finalPosition: number;
  usedPlusOne: boolean;
  reachedFinish: boolean;
}

export function resolveCorrectAnswer(
  currentPosition: number,
  targetCell: BoardCell,
  finishPosition: number,
): CorrectResolution {
  const primaryPosition = Math.min(targetCell.position, finishPosition);
  const usedPlusOne = targetCell.modifier === "PLUS_ONE" && primaryPosition < finishPosition;
  const finalPosition = usedPlusOne
    ? Math.min(primaryPosition + 1, finishPosition)
    : primaryPosition;

  return {
    primaryPosition,
    finalPosition,
    usedPlusOne,
    reachedFinish: finalPosition >= finishPosition,
  };
}

export interface IncorrectResolution {
  finalPosition: number;
  drinkCount: 1 | 2;
}

export function resolveIncorrectAnswer(
  currentPosition: number,
  targetCell: BoardCell,
): IncorrectResolution {
  return {
    finalPosition: currentPosition,
    drinkCount: targetCell.modifier === "PLUS_ONE" ? 2 : 1,
  };
}

export function validateAnswerWordCount(answer: string): boolean {
  const words = answer.trim().split(/\s+/u).filter(Boolean);
  return words.length >= 1 && words.length <= 5;
}
