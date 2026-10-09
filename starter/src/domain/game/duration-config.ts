const PRESET_CELLS = new Map<number, number>([
  [20, 4],
  [30, 5],
  [45, 7],
  [60, 9],
]);

export interface DurationConfig {
  minutesPerCell: number;
  minCells: number;
  maxCells: number;
}

export const DEFAULT_DURATION_CONFIG: DurationConfig = {
  minutesPerCell: 6.5,
  minCells: 3,
  maxCells: 15,
};

export function durationToCells(
  minutes: number,
  config: DurationConfig = DEFAULT_DURATION_CONFIG,
): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("La durada ha de ser un nombre positiu.");
  }

  const preset = PRESET_CELLS.get(minutes);
  if (preset !== undefined) return preset;

  const estimated = Math.round(minutes / config.minutesPerCell);
  return Math.min(config.maxCells, Math.max(config.minCells, estimated));
}
