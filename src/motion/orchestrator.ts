import type { ConfirmedGameEffect } from './effects';

export type EffectRunner = (effect: ConfirmedGameEffect, signal: AbortSignal) => Promise<void>;

/** Serializes visual work without ever changing the authoritative game state. */
export class GameEventOrchestrator {
  private chain: Promise<void> = Promise.resolve();
  private played = new Set<string>();
  private controller = new AbortController();
  private gameId: string | null = null;
  private hydratedVersion = -1;
  private highestVersion = -1;
  private generation = 0;

  hydrate(gameId: string, version: number): void {
    this.cancel();
    this.gameId = gameId;
    this.hydratedVersion = version;
    this.highestVersion = version;
    this.played.clear();
  }

  enqueue(effect: ConfirmedGameEffect, runner: EffectRunner): Promise<void> {
    if (this.gameId !== effect.gameId) this.hydrate(effect.gameId, effect.stateVersion - 1);
    const key = `${effect.stateVersion}:${effect.id}:${effect.type}`;
    if (effect.stateVersion <= this.hydratedVersion || effect.stateVersion < this.highestVersion || this.played.has(key)) return this.chain;
    this.highestVersion = Math.max(this.highestVersion, effect.stateVersion);
    this.played.add(key);
    // Keep a version watermark so pruning cannot let old notifications replay.
    if (this.played.size > 120) {
      for (const playedKey of this.played) if (Number(playedKey.split(':')[0]) < this.highestVersion - 20) this.played.delete(playedKey);
    }
    const generation = this.generation;
    const signal = this.controller.signal;
    this.chain = this.chain.catch(() => undefined).then(async () => {
      if (generation === this.generation && !signal.aborted) await runner(effect, signal);
    });
    return this.chain;
  }

  cancel(): void {
    this.controller.abort();
    this.controller = new AbortController();
    this.generation += 1;
    this.chain = Promise.resolve();
  }

  async settled(): Promise<void> { await this.chain.catch(() => undefined); }
}
