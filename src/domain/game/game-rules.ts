import type { BoardCell, CellType, PlayerRole, QuestionPool } from './game-types';

export function otherPlayer(player: PlayerRole): PlayerRole { return player === 'PAU' ? 'TECLA' : 'PAU'; }
export function poolForCell(cellType: CellType, currentTurn: PlayerRole): QuestionPool {
  if (cellType === 'TP') return 'TP';
  if (cellType === 'PERSONAL') return currentTurn;
  return currentTurn === 'PAU' ? 'PAU_TECLA' : 'TECLA_PAU';
}

/** Reference calculation for validation; only the server persists game changes. */
export function resolveCorrectAnswer(currentPosition: number, targetCell: BoardCell, finishPosition: number) {
  if (!Number.isInteger(currentPosition) || currentPosition < 0 || currentPosition >= finishPosition || targetCell.position !== currentPosition + 1) {
    throw new Error('La casella de destí ha de ser la següent.');
  }
  const primaryPosition = Math.min(targetCell.position, finishPosition);
  const usedPlusOne = targetCell.modifier === 'PLUS_ONE' && primaryPosition < finishPosition;
  const finalPosition = Math.min(primaryPosition + (usedPlusOne ? 1 : 0), finishPosition);
  return { primaryPosition, finalPosition, usedPlusOne, reachedFinish: finalPosition === finishPosition };
}

export function resolveIncorrectAnswer(currentPosition: number, targetCell: BoardCell): { finalPosition: number; drinkCount: 1 | 2 } {
  return { finalPosition: currentPosition, drinkCount: targetCell.modifier === 'PLUS_ONE' ? 2 : 1 };
}

export function validateAnswerWordCount(answer: string): boolean {
  const count = answer.trim().split(/\s+/u).filter(Boolean).length;
  return count >= 1 && count <= 5;
}
