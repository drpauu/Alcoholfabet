import { describe, expect, it } from 'vitest';
import { boardWindow, BOARD_WINDOW_STEP } from '../../src/domain/game/board-window';

describe('readable long boards', () => {
  it('preserves the complete existing short boards', () => {
    for (let finish = 3; finish <= 15; finish++) {
      expect(boardWindow(finish, 9)).toEqual({ start: 0, end: finish, lastStart: 0 });
    }
  });
  it('keeps every confirmed movement and single +1 inside the focused segment', () => {
    for (const finish of [17, 25, 38, 50]) {
      for (let target = 1; target <= finish; target++) {
        const window = boardWindow(finish, target);
        expect(window.start).toBeLessThanOrEqual(target - 1);
        expect(window.end).toBeGreaterThanOrEqual(Math.min(finish, target + 1));
        expect(window.end - window.start).toBeLessThanOrEqual(12);
      }
    }
  });
  it('lets players inspect the full persisted route without gaps or changing positions', () => {
    for (const finish of [17, 25, 38, 50]) {
      const covered = new Set<number>();
      const last = boardWindow(finish, 1).lastStart;
      for (let start = 0; start <= last; start += BOARD_WINDOW_STEP) {
        const window = boardWindow(finish, 1, start);
        for (let position = window.start; position <= window.end; position++) covered.add(position);
      }
      expect([...covered].sort((a, b) => a - b)).toEqual(Array.from({ length: finish + 1 }, (_, i) => i));
      expect(boardWindow(finish, 1, -10).start).toBe(0);
      expect(boardWindow(finish, 1, 100).start).toBe(last);
    }
  });
});
