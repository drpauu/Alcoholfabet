import type { BoardCell, CellModifier, CellType } from "./game-types";

export interface BoardGenerationOptions {
  length: number;
  seed: string;
  plusOneRate?: number;
  weights?: Record<CellType, number>;
}

const DEFAULT_WEIGHTS: Record<CellType, number> = {
  PERSONAL: 0.35,
  CROSSED: 0.35,
  TP: 0.30,
};

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (const char of seed) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(random: () => number, weights: Record<CellType, number>): CellType {
  const entries = Object.entries(weights) as Array<[CellType, number]>;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let cursor = random() * total;
  for (const [type, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return type;
  }
  return entries.at(-1)?.[0] ?? "PERSONAL";
}

function wouldMakeThreeInARow(cells: BoardCell[], next: CellType): boolean {
  return cells.length >= 2 && cells.at(-1)?.type === next && cells.at(-2)?.type === next;
}

export function generateBoard(options: BoardGenerationOptions): BoardCell[] {
  const { length, seed, plusOneRate = 0.12, weights = DEFAULT_WEIGHTS } = options;
  if (!Number.isInteger(length) || length < 3 || length > 15) {
    throw new Error("La longitud del tauler ha d'estar entre 3 i 15.");
  }

  const random = mulberry32(hashSeed(seed));
  const cells: BoardCell[] = [];

  for (let index = 0; index < length; index += 1) {
    let type = weightedPick(random, weights);
    let guard = 0;
    while (wouldMakeThreeInARow(cells, type) && guard < 12) {
      type = weightedPick(random, weights);
      guard += 1;
    }

    const isFirst = index === 0;
    const isBeforeFinish = index === length - 1;
    const previousPlusOne = cells.at(-1)?.modifier === "PLUS_ONE";
    const canHavePlusOne = !isFirst && !isBeforeFinish && !previousPlusOne;
    const modifier: CellModifier = canHavePlusOne && random() < plusOneRate ? "PLUS_ONE" : "NONE";

    cells.push({ position: index + 1, type, modifier });
  }

  if (length >= 4 && !cells.some((cell) => cell.type === "TP")) {
    const candidate = Math.max(1, Math.min(length - 2, Math.floor(length / 2)));
    cells[candidate] = { ...cells[candidate], type: "TP" };
  }

  return cells;
}
