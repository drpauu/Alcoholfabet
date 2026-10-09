export interface DurationConfig {
  estimatedTurnSeconds: number;
  players: number;
  estimatedCorrectRate: number;
  estimatedPlusOneRate: number;
  minMinutes: number;
  maxMinutes: number;
  minCells: number;
  maxCells: number;
}
export const DURATION_PRESETS = [20, 30, 45, 60] as const;
export const DEFAULT_DURATION_CONFIG: DurationConfig = {
  estimatedTurnSeconds: 30, players: 2, estimatedCorrectRate: 0.75, estimatedPlusOneRate: 0.12,
  minMinutes: 10, maxMinutes: 60, minCells: 3, maxCells: 50,
};

export function durationToCells(minutes: number, config = DEFAULT_DURATION_CONFIG): number {
  if (!Number.isFinite(config.estimatedTurnSeconds) || config.estimatedTurnSeconds <= 0
    || config.players !== 2 || !Number.isFinite(config.estimatedCorrectRate) || config.estimatedCorrectRate <= 0 || config.estimatedCorrectRate > 1
    || !Number.isFinite(config.estimatedPlusOneRate) || config.estimatedPlusOneRate < 0 || config.estimatedPlusOneRate > 1
    || !Number.isInteger(config.minMinutes) || !Number.isInteger(config.maxMinutes) || config.minMinutes < 10 || config.maxMinutes > 60 || config.minMinutes > config.maxMinutes
    || !Number.isInteger(config.minCells) || !Number.isInteger(config.maxCells) || config.minCells < 3 || config.maxCells > 50 || config.minCells > config.maxCells) {
    throw new Error('La configuració de durada no és vàlida.');
  }
  if (!Number.isInteger(minutes) || minutes < config.minMinutes || minutes > config.maxMinutes) throw new Error('La durada ha de ser entre 10 i 60 minuts enters.');
  const estimatedCells = minutes * 60 * config.estimatedCorrectRate * (1 + config.estimatedPlusOneRate)
    / (config.players * config.estimatedTurnSeconds);
  return Math.min(config.maxCells, Math.max(config.minCells, Math.round(estimatedCells)));
}
