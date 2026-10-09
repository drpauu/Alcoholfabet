export const BOARD_WINDOW_STEP = 10;
const BOARD_WINDOW_LENGTH = 12;

/** Overlap keeps the complete one-cell and +1 movement on the same SVG route. */
export function boardWindow(finishPosition: number, focus: number, requestedStart?: number) {
  if (finishPosition <= 15) return { start: 0, end: finishPosition, lastStart: 0 };
  const lastStart = Math.floor((finishPosition - 1) / BOARD_WINDOW_STEP) * BOARD_WINDOW_STEP;
  const start = Math.min(lastStart, Math.max(0, requestedStart ?? Math.floor(Math.max(0, focus - 2) / BOARD_WINDOW_STEP) * BOARD_WINDOW_STEP));
  return { start, end: Math.min(finishPosition, start + BOARD_WINDOW_LENGTH), lastStart };
}
