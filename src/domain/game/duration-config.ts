const PRESET_CELLS = new Map([[20, 4], [30, 5], [45, 7], [60, 9]]);
export interface DurationConfig { minutesPerCell: number; minCells: number; maxCells: number }
export const DEFAULT_DURATION_CONFIG: DurationConfig = { minutesPerCell: 6.5, minCells: 3, maxCells: 15 };

export function durationToCells(minutes: number, config = DEFAULT_DURATION_CONFIG): number {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('La durada ha de ser un nombre positiu.');
  if (!Number.isFinite(config.minutesPerCell) || config.minutesPerCell <= 0 || !Number.isInteger(config.minCells) || !Number.isInteger(config.maxCells) || config.minCells < 3 || config.maxCells > 15 || config.minCells > config.maxCells) {
    throw new Error('La configuració de durada no és vàlida.');
  }
  return Math.min(config.maxCells, Math.max(config.minCells, PRESET_CELLS.get(minutes) ?? Math.round(minutes / config.minutesPerCell)));
}
