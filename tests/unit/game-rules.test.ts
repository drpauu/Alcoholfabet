import { describe, expect, it } from 'vitest';
import { generateBoard } from '../../src/domain/game/board-generator';
import { durationToCells } from '../../src/domain/game/duration-config';
import { poolForCell, resolveCorrectAnswer, resolveIncorrectAnswer } from '../../src/domain/game/game-rules';

describe('approved game rules', () => {
  it('uses the approved durations and bounded custom durations', () => {
    expect([20, 30, 45, 60].map((duration) => durationToCells(duration))).toEqual([4, 5, 7, 9]);
    expect(durationToCells(1)).toBe(3);
    expect(durationToCells(180)).toBe(15);
    expect(() => durationToCells(NaN)).toThrow();
  });

  it('never permits a three-category run, even with a single weighted pool', () => {
    for (let seed = 0; seed < 250; seed += 1) {
      for (const weights of [{ PERSONAL: .35, CROSSED: .35, TP: .3 }, { PERSONAL: 1, CROSSED: 0, TP: 0 }]) {
        const board = generateBoard({ length: 15, seed: String(seed), weights, plusOneRate: 1 });
        expect(board).toEqual(generateBoard({ length: 15, seed: String(seed), weights, plusOneRate: 1 }));
        expect(board.some((cell) => cell.type === 'TP')).toBe(true);
        expect(board[0].modifier).toBe('NONE');
        expect(board.at(-1)?.modifier).toBe('NONE');
        for (let index = 2; index < board.length; index += 1) expect(board[index].type === board[index - 1].type && board[index].type === board[index - 2].type).toBe(false);
        for (let index = 1; index < board.length; index += 1) expect(board[index].modifier === 'PLUS_ONE' && board[index - 1].modifier === 'PLUS_ONE').toBe(false);
      }
    }
  });

  it('maps the crossed respondent and uses a single +1 without chaining', () => {
    expect(poolForCell('CROSSED', 'PAU')).toBe('PAU_TECLA');
    expect(poolForCell('CROSSED', 'TECLA')).toBe('TECLA_PAU');
    const cell = { position: 4, type: 'TP' as const, modifier: 'PLUS_ONE' as const };
    expect(resolveCorrectAnswer(3, cell, 5)).toEqual({ primaryPosition: 4, finalPosition: 5, usedPlusOne: true, reachedFinish: true });
    expect(resolveIncorrectAnswer(3, cell)).toEqual({ finalPosition: 3, drinkCount: 2 });
    expect(() => resolveCorrectAnswer(1, cell, 5)).toThrow();
  });
});
