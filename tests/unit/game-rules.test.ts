import { describe, expect, it } from 'vitest';
import { generateBoard } from '../../src/domain/game/board-generator';
import { durationToCells } from '../../src/domain/game/duration-config';
import { poolForCell, resolveCorrectAnswer, resolveIncorrectAnswer } from '../../src/domain/game/game-rules';

describe('approved game rules', () => {
  it('uses the approved durations and bounded custom durations', () => {
    expect([20, 30, 45, 60].map((duration) => durationToCells(duration))).toEqual([17, 25, 38, 50]);
    expect(durationToCells(10)).toBe(8);
    for (const duration of [1, 9, 61, 180, 20.5, Infinity]) expect(() => durationToCells(duration)).toThrow();
    expect(() => durationToCells(NaN)).toThrow();
  });

  it('never permits a three-category run, even with a single weighted pool', () => {
    for (let seed = 0; seed < 250; seed += 1) {
      for (const weights of [{ PERSONAL: .4, CROSSED: .4, TP: .2 }, { PERSONAL: 1, CROSSED: 0, TP: 0 }]) {
        const board = generateBoard({ length: 50, seed: String(seed), weights, plusOneRate: 1 });
        expect(board).toEqual(generateBoard({ length: 50, seed: String(seed), weights, plusOneRate: 1 }));
        expect(board.some((cell) => cell.type === 'TP')).toBe(true);
        expect(board[0].modifier).toBe('NONE');
        expect(board.at(-1)?.modifier).toBe('NONE');
        expect(board.at(-2)?.modifier).toBe('NONE');
        for (let index = 2; index < board.length; index += 1) expect(board[index].type === board[index - 1].type && board[index].type === board[index - 2].type).toBe(false);
        for (let index = 1; index < board.length; index += 1) expect(board[index].modifier === 'PLUS_ONE' && board[index - 1].modifier === 'PLUS_ONE').toBe(false);
      }
    }
  });

  it('balances the five finite question pools and distributes the estimated bonuses', () => {
    const board = generateBoard({ length: 50, seed: 'long-duration' });
    expect(board.filter(cell => cell.type === 'PERSONAL')).toHaveLength(20);
    expect(board.filter(cell => cell.type === 'CROSSED')).toHaveLength(20);
    expect(board.filter(cell => cell.type === 'TP')).toHaveLength(10);
    expect(board.filter(cell => cell.modifier === 'PLUS_ONE').map(cell => cell.position)).toEqual([7, 14, 21, 28, 35, 42]);
    for (let length = 3; length <= 50; length += 1) {
      const cells = generateBoard({ length, seed: 'boundary-lengths' });
      const bonuses = cells.filter(cell => cell.modifier === 'PLUS_ONE').map(cell => cell.position);
      expect(bonuses.every(position => position > 1 && position < length - 1)).toBe(true);
      expect(bonuses.every((position, index) => index === 0 || position - bonuses[index - 1] > 1)).toBe(true);
    }
    expect(() => generateBoard({ length: 51, seed: 'invalid' })).toThrow();
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
