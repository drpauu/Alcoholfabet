import type { BoardCell, CellType } from './game-types';

export interface BoardGenerationOptions { length: number; seed: string; plusOneRate?: number; weights?: Record<CellType, number> }
const DEFAULT_WEIGHTS: Record<CellType, number> = { PERSONAL: 0.35, CROSSED: 0.35, TP: 0.30 };
const CATEGORIES: CellType[] = ['PERSONAL', 'CROSSED', 'TP'];

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makesTriple(cells: BoardCell[], type: CellType): boolean {
  return cells.length >= 2 && cells.at(-1)?.type === type && cells.at(-2)?.type === type;
}

export function generateBoard({ length, seed, plusOneRate = 0.12, weights = DEFAULT_WEIGHTS }: BoardGenerationOptions): BoardCell[] {
  if (!Number.isInteger(length) || length < 3 || length > 15) throw new Error("La longitud del tauler ha d'estar entre 3 i 15.");
  if (!Number.isFinite(plusOneRate) || plusOneRate < 0 || plusOneRate > 1 || CATEGORIES.some((type) => !Number.isFinite(weights[type]) || weights[type] < 0) || CATEGORIES.every((type) => weights[type] === 0)) {
    throw new Error('Les proporcions del tauler no són vàlides.');
  }
  const random = seededRandom(seed);
  const cells: BoardCell[] = [];
  for (let index = 0; index < length; index += 1) {
    const eligible = CATEGORIES.filter((type) => !makesTriple(cells, type));
    const total = eligible.reduce((sum, type) => sum + weights[type], 0);
    let cursor = random() * (total || eligible.length);
    let type = eligible.at(-1)!;
    for (const candidate of eligible) {
      cursor -= total ? weights[candidate] : 1;
      if (cursor < 0) { type = candidate; break; }
    }
    const canPlus = index > 0 && index < length - 1 && cells.at(-1)?.modifier !== 'PLUS_ONE';
    cells.push({ position: index + 1, type, modifier: canPlus && random() < plusOneRate ? 'PLUS_ONE' : 'NONE' });
  }
  if (!cells.some((cell) => cell.type === 'TP')) {
    // Changing a non-TP cell to TP cannot create three TP cells or another triple.
    cells[Math.floor(length / 2)].type = 'TP';
  }
  return cells;
}
