import { describe, expect, it } from 'vitest';
import durationData from '../../data/duration_config.json';
import boardRules from '../../data/board_rules.json';
import { DEFAULT_DURATION_CONFIG, DURATION_PRESETS, durationToCells } from '../../src/domain/game/duration-config';
import { generateBoard } from '../../src/domain/game/board-generator';

describe('duration estimate and finite question bank', () => {
  it('keeps the approved JSON and runtime estimate in agreement at every supported minute', () => {
    expect(DURATION_PRESETS).toEqual(durationData.presets.map(preset => preset.minutes));
    expect(DEFAULT_DURATION_CONFIG).toMatchObject({
      estimatedTurnSeconds: durationData.estimatedTurnSeconds,
      players: durationData.players,
      estimatedCorrectRate: durationData.estimatedCorrectRate,
      estimatedPlusOneRate: durationData.estimatedPlusOneRate,
      minMinutes: durationData.custom.minMinutes,
      maxMinutes: durationData.custom.maxMinutes,
      minCells: durationData.custom.minCells,
      maxCells: durationData.custom.maxCells,
    });
    for (let minutes = 10; minutes <= 60; minutes += 1) {
      expect(durationToCells(minutes)).toBe(Math.round(minutes * 0.84));
      expect(generateBoard({ length: durationToCells(minutes), seed: 'persisted-contract' })).toHaveLength(durationToCells(minutes));
    }
    expect(durationData.automaticTurnTimeout).toBe(false);
  });

  it('applies the turn, accuracy and bonus estimate to presets as well as custom durations', () => {
    expect(durationToCells(20, { ...DEFAULT_DURATION_CONFIG, estimatedTurnSeconds: 60 })).toBe(8);
    expect(durationToCells(20, { ...DEFAULT_DURATION_CONFIG, estimatedCorrectRate: 0.5, estimatedPlusOneRate: 0 })).toBe(10);
    for (const override of [{ estimatedTurnSeconds: 0 }, { players: 1 }, { estimatedCorrectRate: 0 }, { estimatedCorrectRate: 1.1 }, { estimatedPlusOneRate: -1 }, { maxCells: 51 }]) {
      expect(() => durationToCells(20, { ...DEFAULT_DURATION_CONFIG, ...override })).toThrow();
    }
  });

  it('keeps board metadata, the long-board pattern and all five pool shares consistent', () => {
    expect(boardRules.categoryWeights).toEqual(durationData.categoryWeights);
    expect(boardRules.plusOneRate).toBe(durationData.estimatedPlusOneRate);
    const board = generateBoard({ length: 50, seed: 'finite-pool-metadata' });
    for (const [category, proportion] of Object.entries(boardRules.categoryWeights)) {
      expect(board.filter(cell => cell.type === category)).toHaveLength(50 * proportion);
    }
    expect(boardRules.categoryWeights.PERSONAL / 2).toBe(boardRules.categoryWeights.TP);
    expect(boardRules.categoryWeights.CROSSED / 2).toBe(boardRules.categoryWeights.TP);
  });
});
